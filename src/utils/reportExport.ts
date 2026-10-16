import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Equipment, InspectionRecord } from '../types';
import { formatThaiDate, calculateEquipmentAge } from './thaiDate';
import { getApiUrl } from '../services/storage';
import { fetchImageAsBlob } from './imageFetcher';

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
    XLSX.utils.book_append_sheet(wb, wsHD, 'หัวจ่ายน้ำ HD');
  }

  // Sheet 6: FDC
  const fdcData = equipData.filter(e => e['ประเภท'] === 'FDC');
  if (fdcData.length > 0) {
    const wsFDC = XLSX.utils.json_to_sheet(fdcData);
    XLSX.utils.book_append_sheet(wb, wsFDC, 'หัวรับน้ำ FDC');
  }

  // Sheet 7: Inspections History
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

  const appendPhoto = async (photoUrl: string | undefined | null, filename: string) => {
    if (!photoUrl) return;
    try {
      const blob = await fetchImageAsBlob(photoUrl);
      if (blob && blob.size > 0) {
        const ext = blob.type && blob.type.includes('png') ? 'png' : 'jpg';
        folder?.file(`${filename}.${ext}`, blob);
        count++;
      } else if (photoUrl.startsWith('data:image')) {
        const parts = photoUrl.split(',');
        const ext = parts[0].includes('png') ? 'png' : 'jpg';
        folder?.file(`${filename}.${ext}`, parts[1], { base64: true });
        count++;
      }
    } catch (err) {
      console.warn(`Could not fetch photo for ${filename}:`, err);
    }
  };

  for (const item of targets) {
    if (item.inspection_sheet_photo) {
      await appendPhoto(item.inspection_sheet_photo, `${item.code}_inspection_sheet`);
    }
    if (item.location_photo) {
      await appendPhoto(item.location_photo, `${item.code}_location`);
    }
    if (item.defect_photo) {
      await appendPhoto(item.defect_photo, `${item.code}_defect_issue`);
    }
  }

  if (count === 0) {
    // If photos cannot be fetched, generate a manifest text file
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
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 10000);
}
