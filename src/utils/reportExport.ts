import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Equipment, InspectionRecord } from '../types';
import { formatThaiDate, getNowThai, calculateEquipmentAge } from './thaiDate';

/**
 * Export data to PDF report
 */
export function exportToPDF(
  equipmentList: Equipment[],
  inspections: InspectionRecord[],
  reportType: 'MONTHLY' | 'YEARLY',
  selectedPeriod: string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const now = getNowThai();

  // Document Title Header
  doc.setFontSize(18);
  doc.setTextColor(220, 38, 38); // Fire red
  doc.text('SHE SYSTEM - FIRE SAFETY INSPECTION REPORT', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(`รายงานผลการตรวจสอบระบบและอุปกรณ์ดับเพลิง (${reportType === 'MONTHLY' ? 'ประจำเดือน' : 'ประจำปี'}: ${selectedPeriod})`, 14, 26);
  doc.text(`วันที่พิมพ์รายงาน: ${formatThaiDate(now, true)}`, 14, 32);

  // Statistics Summary Box
  const total = equipmentList.length;
  const inspected = equipmentList.filter(e => e.inspection_status === 'INSPECTED').length;
  const ready = equipmentList.filter(e => e.ready_status === 'READY').length;
  const defects = equipmentList.filter(e => e.defect_status === 'DEFECT').length;
  const resolved = equipmentList.filter(e => e.defect_status === 'RESOLVED').length;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 37, 182, 22, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`อุปกรณ์ทั้งหมด: ${total} รายการ`, 18, 44);
  doc.text(`ตรวจแล้ว: ${inspected} (${total > 0 ? Math.round((inspected / total) * 100) : 0}%)`, 65, 44);
  doc.text(`พร้อมใช้งาน: ${ready} รายการ`, 115, 44);
  doc.text(`พบข้อบกพร่อง: ${defects} รายการ`, 18, 52);
  doc.text(`แก้ไขแล้ว: ${resolved} รายการ`, 65, 52);
  doc.text(`ยังไม่ตรวจ: ${total - inspected} รายการ`, 115, 52);

  // Table Data
  const tableRows = equipmentList.map((e, idx) => {
    const age = calculateEquipmentAge(e.in_service_date, e.latest_inspection_date);
    return [
      idx + 1,
      e.code,
      e.type,
      e.location,
      e.inspection_status === 'INSPECTED' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
      e.ready_status === 'READY' ? 'พร้อมใช้' : 'ไม่พร้อมใช้',
      e.defect_status === 'DEFECT' ? 'พบปัญหา' : (e.defect_status === 'RESOLVED' ? 'แก้ไขแล้ว' : 'ปกติ'),
      age.formatted,
      e.latest_inspector || '-'
    ];
  });

  autoTable(doc, {
    startY: 64,
    head: [['ลำดับ', 'รหัส', 'ประเภท', 'สถานที่ติดตั้ง', 'สถานะตรวจ', 'ความพร้อม', 'สภาพ', 'อายุถัง/อุปกรณ์', 'ผู้ตรวจล่าสุด']],
    body: tableRows,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20, fontStyle: 'bold' },
      2: { cellWidth: 16 },
      3: { cellWidth: 45 },
      4: { cellWidth: 20 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 22 },
      8: { cellWidth: 22 }
    }
  });

  doc.save(`SHE_Inspection_Report_${selectedPeriod.replace(/\s+/g, '_')}.pdf`);
}

/**
 * Export data to Excel (.xlsx) file
 */
export function exportToExcel(
  equipmentList: Equipment[],
  inspections: InspectionRecord[],
  selectedPeriod: string
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary & Equipment List
  const equipData = equipmentList.map(e => {
    const age = calculateEquipmentAge(e.in_service_date, e.latest_inspection_date);
    return {
      'รหัสอุปกรณ์': e.code,
      'ประเภท': e.type,
      'รายละเอียด/รุ่น': e.category || '-',
      'ขนาด/น้ำหนัก': e.weight || '-',
      'สถานที่ติดตั้ง': e.location,
      'วันที่เริ่มใช้งาน': e.in_service_date || '-',
      'อายุอุปกรณ์': age.formatted,
      'สถานะการตรวจ': e.inspection_status === 'INSPECTED' ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
      'สถานะความพร้อม': e.ready_status === 'READY' ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน',
      'สถานะข้อบกพร่อง': e.defect_status === 'DEFECT' ? 'พบปัญหา' : (e.defect_status === 'RESOLVED' ? 'ปัญหาได้รับการแก้ไขแล้ว' : 'ปกติ'),
      'หมายเหตุปัญหา': e.defect_notes || '-',
      'ผู้รับผิดชอบ': e.responsible_person,
      'ผู้ตรวจสอบล่าสุด': e.latest_inspector || '-',
      'วันที่ตรวจล่าสุด': e.latest_inspection_date ? formatThaiDate(e.latest_inspection_date, true) : '-'
    };
  });

  const wsEquip = XLSX.utils.json_to_sheet(equipData);
  XLSX.utils.book_append_sheet(wb, wsEquip, 'อุปกรณ์ทั้งหมด');

  // Sheet 2: Fire Extinguishers (EX)
  const exData = equipData.filter(e => e['ประเภท'] === 'EX');
  if (exData.length > 0) {
    const wsEX = XLSX.utils.json_to_sheet(exData);
    XLSX.utils.book_append_sheet(wb, wsEX, 'ถังดับเพลิง EX');
  }

  // Sheet 3: Fire Hose Cabinets (FHC)
  const fhcData = equipData.filter(e => e['ประเภท'] === 'FHC');
  if (fhcData.length > 0) {
    const wsFHC = XLSX.utils.json_to_sheet(fhcData);
    XLSX.utils.book_append_sheet(wb, wsFHC, 'ตู้ดับเพลิง FHC');
  }

  // Sheet 4: Hose Racks (FH)
  const fhData = equipData.filter(e => e['ประเภท'] === 'FH');
  if (fhData.length > 0) {
    const wsFH = XLSX.utils.json_to_sheet(fhData);
    XLSX.utils.book_append_sheet(wb, wsFH, 'ตู้สายฉีด FH');
  }

  // Sheet 5: Hydrant (HD)
  const hdData = equipData.filter(e => e['ประเภท'] === 'HD');
  if (hdData.length > 0) {
    const wsHD = XLSX.utils.json_to_sheet(hdData);
    XLSX.utils.book_append_sheet(wb, wsHD, 'หัวรับน้ำ HD');
  }

  // Sheet 6: Inspections History
  if (inspections.length > 0) {
    const inspData = inspections.map(i => ({
      'รหัสบันทึก': i.id,
      'รหัสอุปกรณ์': i.equipment_code || i.equipment_id,
      'ผู้ตรวจ': i.inspector_name,
      'วันที่ตรวจ': formatThaiDate(i.inspection_date, true),
      'ผลตรวจ': i.ready_status === 'READY' ? 'พร้อมใช้' : 'ไม่พร้อมใช้',
      'พบสิ่งผิดปกติ': i.is_abnormal ? 'ใช่' : 'ไม่ใช่',
      'คำอธิบายความผิดปกติ': i.abnormal_description || '-',
      'สถานะการแก้ไข': i.defect_resolved ? 'แก้ไขแล้ว' : 'ยังไม่แก้ไข'
    }));
    const wsInsp = XLSX.utils.json_to_sheet(inspData);
    XLSX.utils.book_append_sheet(wb, wsInsp, 'ประวัติการตรวจเช็ค');
  }

  XLSX.writeFile(wb, `SHE_Safety_Report_${selectedPeriod.replace(/\s+/g, '_')}.xlsx`);
}

/**
 * Export photos to a zip file or trigger download
 */
export async function exportEquipmentPhotos(equipmentList: Equipment[], targetCode?: string) {
  const zip = new JSZip();
  const folder = zip.folder('SHE_Equipment_Photos');

  const targets = targetCode ? equipmentList.filter(e => e.code === targetCode) : equipmentList;
  let count = 0;

  for (const item of targets) {
    // Add inspection sheet photo if available
    if (item.inspection_sheet_photo && item.inspection_sheet_photo.startsWith('data:image')) {
      const base64Data = item.inspection_sheet_photo.split(',')[1];
      folder?.file(`${item.code}_inspection_sheet.jpg`, base64Data, { base64: true });
      count++;
    }

    // Add location photo if available
    if (item.location_photo && item.location_photo.startsWith('data:image')) {
      const base64Data = item.location_photo.split(',')[1];
      folder?.file(`${item.code}_location.jpg`, base64Data, { base64: true });
      count++;
    }

    // Add defect photo if available
    if (item.defect_photo && item.defect_photo.startsWith('data:image')) {
      const base64Data = item.defect_photo.split(',')[1];
      folder?.file(`${item.code}_defect_issue.jpg`, base64Data, { base64: true });
      count++;
    }
  }

  if (count === 0) {
    // If photos are remote URLs (Unsplash/R2), open the photos or generate dummy placeholder text file
    folder?.file('readme.txt', `รายการลิงก์รูปภาพสำหรับ ${targetCode || 'อุปกรณ์ทั้งหมด'}:\n\n` +
      targets.map(t => `${t.code}:\n- ใบตรวจ: ${t.inspection_sheet_photo || 'ไม่มี'}\n- สถานที่: ${t.location_photo || 'ไม่มี'}\n- ปัญหา: ${t.defect_photo || 'ไม่มี'}`).join('\n\n')
    );
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = targetCode ? `Photos_${targetCode}.zip` : `SHE_All_Photos.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
