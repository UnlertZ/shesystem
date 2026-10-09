import React, { useRef, useState } from 'react';
import { Equipment, InspectionRecord } from '../types';
import { SheLogo } from './SheLogo';
import { formatThaiDate, getNowThai, THAI_MONTHS, THAI_MONTHS_SHORT } from '../utils/thaiDate';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  X,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  FileText,
  Flame,
  Droplets,
  Layers,
  Calendar,
  Info
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReportPreviewModalProps {
  equipmentList: Equipment[];
  inspections: InspectionRecord[];
  reportType: 'MONTHLY' | 'YEARLY';
  selectedPeriod: string;
  selectedYear?: number;
  selectedMonth?: number;
  barChartData: any;
  doughnutData: any;
  onClose: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  equipmentList,
  inspections,
  reportType,
  selectedPeriod,
  selectedYear,
  selectedMonth,
  barChartData,
  doughnutData,
  onClose
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const now = getNowThai();
  const currentYearBE = now.getFullYear() + 543;

  // Determine target year (Buddhist Era)
  const targetYearBE = selectedYear || (() => {
    const match = selectedPeriod.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : currentYearBE;
  })();

  // Overall KPI statistics
  const total = equipmentList.length;
  const inspected = equipmentList.filter(e => e.inspection_status === 'INSPECTED').length;
  const pending = equipmentList.filter(e => e.inspection_status === 'PENDING').length;
  const ready = equipmentList.filter(e => e.ready_status === 'READY').length;
  const defects = equipmentList.filter(e => e.defect_status === 'DEFECT').length;
  const resolved = equipmentList.filter(e => e.defect_status === 'RESOLVED').length;
  const normal = equipmentList.filter(e => e.defect_status === 'NORMAL' || (e.ready_status === 'READY' && e.defect_status !== 'DEFECT')).length;
  const rate = total > 0 ? Math.round((inspected / total) * 100) : 0;

  // 1. Equipment categories breakdown (4 types with exact units requested by user)
  // EX = ถัง, FHC = ตู้, FH = สาย, HD = จุด
  const equipmentCategories = [
    {
      type: 'EX' as const,
      name: 'ถังดับเพลิง (EX)',
      fullName: 'เครื่องดับเพลิงยกหิ้ว (Fire Extinguisher - EX)',
      unit: 'ถัง',
      icon: Flame,
      headerBg: 'bg-red-50 text-red-700 border-red-200'
    },
    {
      type: 'FHC' as const,
      name: 'ตู้ดับเพลิง (FHC)',
      fullName: 'ตู้สายดับเพลิงพร้อมสายฉีด (Fire Hose Cabinet - FHC)',
      unit: 'ตู้',
      icon: ShieldCheck,
      headerBg: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      type: 'FH' as const,
      name: 'ตู้สายฉีดดับเพลิง (FH)',
      fullName: 'ตู้สายฉีดน้ำดับเพลิง (Fire Hose Reel/Rack - FH)',
      unit: 'สาย',
      icon: Droplets,
      headerBg: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    },
    {
      type: 'HD' as const,
      name: 'หัวรับน้ำดับเพลิง (HD)',
      fullName: 'หัวรับน้ำดับเพลิง / หัวจ่ายน้ำดับเพลิง (Fire Hydrant - HD)',
      unit: 'จุด',
      icon: Layers,
      headerBg: 'bg-amber-50 text-amber-700 border-amber-200'
    }
  ];

  const typeSummaries = equipmentCategories.map(cat => {
    const list = equipmentList.filter(e => e.type === cat.type);
    const catTotal = list.length;
    const catInspected = list.filter(e => e.inspection_status === 'INSPECTED').length;
    const catNormal = list.filter(
      e => e.inspection_status === 'INSPECTED' && (e.defect_status === 'NORMAL' || (e.ready_status === 'READY' && e.defect_status !== 'DEFECT'))
    ).length;
    const catDefects = list.filter(
      e => e.defect_status === 'DEFECT' || (e.inspection_status === 'INSPECTED' && e.ready_status === 'NOT_READY')
    ).length;
    const catResolved = list.filter(e => e.defect_status === 'RESOLVED').length;
    const catPending = list.filter(e => e.inspection_status === 'PENDING').length;
    const catRate = catTotal > 0 ? Math.round((catInspected / catTotal) * 100) : 0;

    return {
      ...cat,
      total: catTotal,
      inspected: catInspected,
      normal: catNormal,
      defects: catDefects,
      resolved: catResolved,
      pending: catPending,
      rate: catRate
    };
  });

  // Helper to determine equipment type
  const getEquipType = (equipId?: string, fallbackType?: string) => {
    if (fallbackType) return fallbackType;
    if (!equipId) return 'EX';
    return equipmentList.find(e => e.id === equipId)?.type || 'EX';
  };

  // 2. Month-by-month stats calculation for selected year (ม.ค. - ธ.ค.) - Used in Yearly Report
  const monthlyBreakdown = THAI_MONTHS.map((monthName, monthIdx) => {
    const monthInspections = inspections.filter(rec => {
      if (!rec.inspection_date) return false;
      const d = new Date(rec.inspection_date);
      if (isNaN(d.getTime())) return false;
      const yBE = d.getFullYear() + 543;
      return yBE === targetYearBE && d.getMonth() === monthIdx;
    });

    let totalInspected = monthInspections.length;
    let exCount = monthInspections.filter(r => (r.equipment_type || getEquipType(r.equipment_id)) === 'EX').length;
    let fhcCount = monthInspections.filter(r => (r.equipment_type || getEquipType(r.equipment_id)) === 'FHC').length;
    let fhCount = monthInspections.filter(r => (r.equipment_type || getEquipType(r.equipment_id)) === 'FH').length;
    let hdCount = monthInspections.filter(r => (r.equipment_type || getEquipType(r.equipment_id)) === 'HD').length;
    let defectCount = monthInspections.filter(r => r.is_abnormal).length;
    let resolvedCount = monthInspections.filter(r => r.defect_resolved).length;
    let normalCount = monthInspections.filter(r => !r.is_abnormal).length;

    // Fallback for current month if no historical logs yet but equipment has current inspection state
    if (totalInspected === 0 && monthIdx === now.getMonth() && targetYearBE === currentYearBE) {
      const inspectedEquip = equipmentList.filter(e => e.inspection_status === 'INSPECTED');
      if (inspectedEquip.length > 0) {
        totalInspected = inspectedEquip.length;
        exCount = inspectedEquip.filter(e => e.type === 'EX').length;
        fhcCount = inspectedEquip.filter(e => e.type === 'FHC').length;
        fhCount = inspectedEquip.filter(e => e.type === 'FH').length;
        hdCount = inspectedEquip.filter(e => e.type === 'HD').length;
        defectCount = inspectedEquip.filter(e => e.defect_status === 'DEFECT').length;
        resolvedCount = inspectedEquip.filter(e => e.defect_status === 'RESOLVED').length;
        normalCount = totalInspected - defectCount;
      }
    }

    const passRate = totalInspected > 0 ? Math.round((normalCount / totalInspected) * 100) : 0;

    return {
      monthIdx,
      monthName,
      monthShort: THAI_MONTHS_SHORT[monthIdx],
      exCount,
      fhcCount,
      fhCount,
      hdCount,
      totalInspected,
      normalCount,
      defectCount,
      resolvedCount,
      passRate
    };
  });

  // Calculate annual summary totals
  const yearlyTotals = monthlyBreakdown.reduce(
    (acc, m) => ({
      exCount: acc.exCount + m.exCount,
      fhcCount: acc.fhcCount + m.fhcCount,
      fhCount: acc.fhCount + m.fhCount,
      hdCount: acc.hdCount + m.hdCount,
      totalInspected: acc.totalInspected + m.totalInspected,
      normalCount: acc.normalCount + m.normalCount,
      defectCount: acc.defectCount + m.defectCount,
      resolvedCount: acc.resolvedCount + m.resolvedCount
    }),
    {
      exCount: 0,
      fhcCount: 0,
      fhCount: 0,
      hdCount: 0,
      totalInspected: 0,
      normalCount: 0,
      defectCount: 0,
      resolvedCount: 0
    }
  );

  // 3. Problem / Defect items enumeration (ไล่ระบุเป็นรายการลงไป)
  const defectItems = equipmentList.filter(
    e => e.defect_status === 'DEFECT' || e.defect_status === 'RESOLVED' || (e.defect_notes && e.defect_notes.trim().length > 0)
  );

  // Live Doughnut data aligned with current equipment list
  const liveDoughnutData = {
    labels: ['พร้อมใช้งาน (ปกติ)', 'พบปัญหาแต่แก้ไขแล้ว', 'พบข้อบกพร่อง', 'ยังไม่ได้ตรวจ'],
    datasets: [
      {
        data: [
          Math.max(0, ready - resolved),
          resolved,
          defects,
          pending
        ],
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for sharp graphics and text
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let position = 0;
      let heightLeft = pdfHeight;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`SHE_Report_${reportType}_${selectedPeriod.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด PDF กำลังเปิดหน้าต่างพิมพ์ของเบราว์เซอร์แทน');
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Controls Header */}
        <div className="px-6 py-3.5 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-red-400" />
            <span className="font-bold text-sm">
              ตัวอย่างรายงาน PDF: {reportType === 'MONTHLY' ? 'ประจำเดือน' : 'ประจำปี'} {selectedPeriod}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
              title="สั่งพิมพ์ / บันทึกผ่านเบราว์เซอร์"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Container */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-100/50">
          <div
            ref={reportRef}
            className="bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-3xl mx-auto space-y-6 text-slate-800"
            id="printable-report"
          >
            {/* 1. Executive Report Header */}
            <div className="flex items-start justify-between border-b-2 border-red-600 pb-5">
              <div>
                <SheLogo size="lg" />
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  รายงานผลการตรวจสอบระบบความปลอดภัยและอุปกรณ์ดับเพลิง
                </h2>
                <p className="text-xs text-slate-500">
                  รอบการรายงาน: <strong>{reportType === 'MONTHLY' ? 'ประจำเดือน' : 'ประจำปี'} {selectedPeriod}</strong>
                </p>
              </div>

              <div className="text-right text-xs text-slate-500 space-y-1">
                <div>วันที่ออกรายงาน: <strong>{formatThaiDate(now, true)}</strong></div>
                <div>ระบบ: <strong>SHE Safety Management</strong></div>
                <div className="text-[11px] text-emerald-600 font-semibold">สถานะข้อมูล: อัปเดตล่าสุด</div>
              </div>
            </div>

            {/* 2. Executive Statistics KPI Bar */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                <div className="text-[10px] text-slate-500 font-bold uppercase">อุปกรณ์ทั้งหมด</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{total}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">รายการในระบบ</div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">อัตราการตรวจเสร็จสิ้น</div>
                <div className="text-2xl font-black text-emerald-700 mt-0.5">{rate}%</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">({inspected}/{total})</div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
                <div className="text-[10px] text-blue-700 font-bold uppercase">พร้อมใช้งาน</div>
                <div className="text-2xl font-black text-blue-700 mt-0.5">{ready}</div>
                <div className="text-[10px] text-blue-600 mt-0.5">พร้อมใช้ทันที</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                <div className="text-[10px] text-amber-700 font-bold uppercase">ปัญหา/แก้ไขแล้ว</div>
                <div className="text-2xl font-black text-amber-700 mt-0.5">{resolved} / {defects}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">แก้ไขแล้ว / รอแก้ไข</div>
              </div>
            </div>

            {/* 3. Charts Section */}
            {/* รายเดือน: ลบกราฟแท่งออกตามคำสั่งผู้ใช้ และแสดงสัดส่วนโดนัทแบบชัดเจน */}
            {/* รายปี: แสดงกราฟแท่งเปรียบเทียบสถิติรายปี + กราฟโดนัท */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-sm"></span>
                <span>
                  {reportType === 'MONTHLY'
                    ? `สัดส่วนผลการตรวจสอบรอบเดือน ${selectedPeriod}`
                    : `สรุปผลการตรวจสอบเชิงสถิติ (Charts Overview)`}
                </span>
              </h3>

              {reportType === 'MONTHLY' ? (
                /* Monthly View: NO Bar Chart (ลบกราฟแท่งออกแล้ว) */
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-xs font-bold text-slate-700 mb-2 text-center">
                      สัดส่วนสถานะการตรวจรอบเดือน {selectedPeriod}
                    </div>
                    <div className="h-44 w-44 flex items-center justify-center">
                      <Doughnut
                        data={liveDoughnutData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          animation: false,
                          plugins: { legend: { display: false } },
                          cutout: '65%'
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="flex items-center space-x-2 font-bold text-emerald-800">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                        <span>พร้อมใช้งาน (ปกติ)</span>
                      </span>
                      <span className="font-extrabold text-emerald-800">{Math.max(0, ready - resolved)} รายการ</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="flex items-center space-x-2 font-bold text-blue-800">
                        <span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span>
                        <span>พบปัญหาแต่แก้ไขแล้ว</span>
                      </span>
                      <span className="font-extrabold text-blue-800">{resolved} รายการ</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-50 border border-red-200">
                      <span className="flex items-center space-x-2 font-bold text-red-800">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                        <span>พบข้อบกพร่อง (รอแก้ไข)</span>
                      </span>
                      <span className="font-extrabold text-red-800">{defects} รายการ</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="flex items-center space-x-2 font-bold text-amber-800">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                        <span>ยังไม่ได้ตรวจ</span>
                      </span>
                      <span className="font-extrabold text-amber-800">{pending} รายการ</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Yearly View: Keep Bar Chart + Doughnut Chart */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                    <div className="text-xs font-bold text-slate-700 mb-2 text-center">
                      กราฟเปรียบเทียบสถิติรายปี (2 ปีย้อนหลัง)
                    </div>
                    <div className="h-48">
                      <Bar
                        data={barChartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          animation: false,
                          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                          plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } }
                        }}
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                    <div className="text-xs font-bold text-slate-700 mb-2 text-center">
                      สัดส่วนผลการตรวจสอบสะสม {selectedPeriod}
                    </div>
                    <div className="h-48 flex items-center justify-center">
                      <Doughnut
                        data={liveDoughnutData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          animation: false,
                          plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } },
                          cutout: '60%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. สรุปผลการตรวจแยกตามประเภทอุปกรณ์ (ถัง, FHC, FH, HD) พร้อมระบุหน่วยชัดเจน */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-sm"></span>
                <span>สรุปผลการตรวจสอบแยกตามประเภทอุปกรณ์ ({reportType === 'MONTHLY' ? 'ประจำเดือน' : 'ประจำปี'} {selectedPeriod})</span>
              </h3>

              {/* 4 Cards Grid - ตรงตามที่ผู้ใช้สั่งทั้ง 4 รายการ พร้อมหน่วย ถัง, ตู้, สาย, จุด */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {typeSummaries.map((cat, idx) => (
                  <div
                    key={cat.type}
                    className="border border-slate-200 rounded-xl p-3 bg-slate-50/80 space-y-2 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                      <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                        <span className="font-extrabold text-red-600 mr-0.5">{idx + 1}.</span>
                        <span>{cat.name}</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {cat.type}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>ทั้งหมด:</span>
                        <strong className="text-slate-900">{cat.total} {cat.unit}</strong>
                      </div>
                      <div className="flex items-center justify-between text-blue-700">
                        <span>ตรวจแล้ว:</span>
                        <strong>{cat.inspected} {cat.unit} ({cat.rate}%)</strong>
                      </div>
                      <div className="flex items-center justify-between text-emerald-700">
                        <span>ปกติ:</span>
                        <strong>{cat.normal} {cat.unit}</strong>
                      </div>
                      <div className="flex items-center justify-between text-red-600">
                        <span>ผิดปกติ:</span>
                        <strong className={cat.defects > 0 ? 'text-red-600 font-extrabold' : 'text-slate-500'}>
                          {cat.defects} {cat.unit}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Table - รายละเอียดตารางทางการสำหรับพิมพ์/PDF */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-center w-12">ลำดับ</th>
                      <th className="py-2 px-3">รายการอุปกรณ์</th>
                      <th className="py-2 px-3 text-center">ทั้งหมด</th>
                      <th className="py-2 px-3 text-center">ตรวจแล้ว</th>
                      <th className="py-2 px-3 text-center">ปกติ</th>
                      <th className="py-2 px-3 text-center text-red-600">ผิดปกติ</th>
                      <th className="py-2 px-3 text-center text-blue-600">แก้ไขแล้ว</th>
                      <th className="py-2 px-3 text-center text-amber-600">ยังไม่ตรวจ</th>
                      <th className="py-2 px-3 text-center">ความครอบคลุม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {typeSummaries.map((cat, idx) => (
                      <tr key={cat.type} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {cat.fullName}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">{cat.total} {cat.unit}</td>
                        <td className="py-2 px-3 text-center font-bold text-blue-600">{cat.inspected} {cat.unit}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">{cat.normal} {cat.unit}</td>
                        <td className="py-2 px-3 text-center font-bold text-red-600">
                          {cat.defects > 0 ? `${cat.defects} ${cat.unit}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-medium text-blue-600">
                          {cat.resolved > 0 ? `${cat.resolved} ${cat.unit}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-center text-amber-600">
                          {cat.pending > 0 ? `${cat.pending} ${cat.unit}` : '0'}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-700">{cat.rate}%</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                      <td colSpan={2} className="py-2 px-3 text-right">รวมอุปกรณ์ทุกประเภท:</td>
                      <td className="py-2 px-3 text-center text-slate-900">{total} รายการ</td>
                      <td className="py-2 px-3 text-center text-blue-700">{inspected} รายการ</td>
                      <td className="py-2 px-3 text-center text-emerald-700">{normal} รายการ</td>
                      <td className="py-2 px-3 text-center text-red-700">{defects} รายการ</td>
                      <td className="py-2 px-3 text-center text-blue-700">{resolved} รายการ</td>
                      <td className="py-2 px-3 text-center text-amber-700">{pending} รายการ</td>
                      <td className="py-2 px-3 text-center text-slate-900">{rate}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Yearly Only: ตารางแจกแจงรายเดือนตลอดทั้งปี (เดือนไหนตรวจไรบ้างเหมือนกัน) */}
            {reportType === 'YEARLY' && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></span>
                  <span>สถิติการตรวจเช็ครายเดือนตลอดทั้งปี พ.ศ. {targetYearBE} (Month-by-Month Inspection Breakdown)</span>
                </h3>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">เดือน</th>
                        <th className="py-2 px-2 text-center">ถัง (EX)</th>
                        <th className="py-2 px-2 text-center">FHC</th>
                        <th className="py-2 px-2 text-center">สาย (FH)</th>
                        <th className="py-2 px-2 text-center">หัวน้ำ (HD)</th>
                        <th className="py-2 px-2 text-center">รวมตรวจ</th>
                        <th className="py-2 px-2 text-center text-emerald-600">ปกติ</th>
                        <th className="py-2 px-2 text-center text-red-600">ผิดปกติ</th>
                        <th className="py-2 px-2 text-center text-blue-600">แก้ไขแล้ว</th>
                        <th className="py-2 px-2 text-center">ผ่านเกณฑ์</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {monthlyBreakdown.map((m) => (
                        <tr key={m.monthIdx} className={m.totalInspected > 0 ? 'hover:bg-slate-50' : 'bg-slate-50/30 text-slate-400'}>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {m.monthName}
                          </td>
                          <td className="py-2 px-2 text-center">{m.exCount > 0 ? `${m.exCount} ถัง` : '-'}</td>
                          <td className="py-2 px-2 text-center">{m.fhcCount > 0 ? `${m.fhcCount} ตู้` : '-'}</td>
                          <td className="py-2 px-2 text-center">{m.fhCount > 0 ? `${m.fhCount} สาย` : '-'}</td>
                          <td className="py-2 px-2 text-center">{m.hdCount > 0 ? `${m.hdCount} จุด` : '-'}</td>
                          <td className="py-2 px-2 text-center font-bold text-slate-900">
                            {m.totalInspected > 0 ? `${m.totalInspected} รายการ` : '-'}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-emerald-600">
                            {m.normalCount > 0 ? m.normalCount : '-'}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-red-600">
                            {m.defectCount > 0 ? m.defectCount : '-'}
                          </td>
                          <td className="py-2 px-2 text-center font-medium text-blue-600">
                            {m.resolvedCount > 0 ? m.resolvedCount : '-'}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold">
                            {m.totalInspected > 0 ? `${m.passRate}%` : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-300">
                        <td className="py-2 px-3 font-extrabold text-slate-900">รวมทั้งปี พ.ศ. {targetYearBE}</td>
                        <td className="py-2 px-2 text-center">{yearlyTotals.exCount} ถัง</td>
                        <td className="py-2 px-2 text-center">{yearlyTotals.fhcCount} ตู้</td>
                        <td className="py-2 px-2 text-center">{yearlyTotals.fhCount} สาย</td>
                        <td className="py-2 px-2 text-center">{yearlyTotals.hdCount} จุด</td>
                        <td className="py-2 px-2 text-center text-slate-900">{yearlyTotals.totalInspected} รายการ</td>
                        <td className="py-2 px-2 text-center text-emerald-700">{yearlyTotals.normalCount}</td>
                        <td className="py-2 px-2 text-center text-red-700">{yearlyTotals.defectCount}</td>
                        <td className="py-2 px-2 text-center text-blue-700">{yearlyTotals.resolvedCount}</td>
                        <td className="py-2 px-2 text-center text-slate-900">
                          {yearlyTotals.totalInspected > 0 ? `${Math.round((yearlyTotals.normalCount / yearlyTotals.totalInspected) * 100)}%` : '0%'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. รายการอุปกรณ์ที่ตรวจพบปัญหา / ข้อบกพร่อง (ถ้ามีปัญหาหาตรงไหนก็ไล่ระบุเป็นรายการลงไป) */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-600 rounded-sm"></span>
                  <span>รายการอุปกรณ์ที่พบปัญหา / ข้อบกพร่อง (Defect Items List)</span>
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  พบทั้งหมด: <strong className={defectItems.length > 0 ? 'text-red-600' : 'text-emerald-600'}>{defectItems.length} รายการ</strong>
                </span>
              </h3>

              {defectItems.length === 0 ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs text-emerald-800 space-y-1">
                  <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-600" />
                  <div className="font-bold text-sm">ไม่พบข้อบกพร่องในรอบการตรวจสอบนี้</div>
                  <div className="text-slate-600">อุปกรณ์ทุกรายการผ่านเกณฑ์การตรวจเช็คตามมาตรฐานความปลอดภัย และอยู่ในสภาพพร้อมใช้งาน 100%</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Detailed Defect Table */}
                  <div className="overflow-x-auto rounded-xl border border-red-200 bg-white shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-red-50 text-red-900 font-bold text-[11px] border-b border-red-200">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-12">ลำดับ</th>
                          <th className="py-2.5 px-3">รหัสอุปกรณ์</th>
                          <th className="py-2.5 px-3">ประเภท</th>
                          <th className="py-2.5 px-3">สถานที่ติดตั้ง</th>
                          <th className="py-2.5 px-3">รายละเอียดปัญหา / ข้อบกพร่อง</th>
                          <th className="py-2.5 px-3 text-center">สถานะการแก้ไข</th>
                          <th className="py-2.5 px-3">ผู้ตรวจเช็ค</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {defectItems.map((item, idx) => {
                          const isFixed = item.defect_status === 'RESOLVED';
                          return (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.code}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {item.type}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">{item.location}</td>
                              <td className="py-2.5 px-3 font-medium text-red-700 max-w-xs">
                                {item.defect_notes || 'พบความผิดปกติระหว่างการตรวจเช็คตามเกณฑ์มาตรฐาน'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isFixed ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {isFixed ? '✓ ได้รับการแก้ไขแล้ว' : '⚠ ยังไม่ได้รับการแก้ไข'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                <div>{item.latest_inspector || item.responsible_person || '-'}</div>
                                {item.latest_inspection_date && (
                                  <div className="text-[10px] text-slate-400">
                                    {formatThaiDate(item.latest_inspection_date, false, true)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Before / After Photo Comparison Cards */}
                  <div className="pt-2 space-y-3">
                    <div className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Wrench className="w-3.5 h-3.5 text-slate-600" />
                      <span>ภาพถ่ายหลักฐานจุดที่พบปัญหา และการแก้ไข (Before / After Photos)</span>
                    </div>

                    <div className="space-y-4">
                      {defectItems.map(item => {
                        const isFixed = item.defect_status === 'RESOLVED';
                        const beforePhoto = item.defect_photo || item.inspection_sheet_photo || 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400';
                        const afterPhoto = item.location_photo || 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?w=400';

                        return (
                          <div
                            key={`card-${item.id}`}
                            className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs text-slate-900">{item.code}</span>
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                  {item.type}
                                </span>
                                <span className="text-xs text-slate-500">สถานที่: {item.location}</span>
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isFixed ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {isFixed ? '✓ ได้รับการแก้ไขแล้ว' : '⚠ ยังไม่ได้รับการแก้ไข'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80">
                              <strong className="text-red-700">ข้อบกพร่องที่พบ:</strong>{' '}
                              {item.defect_notes || 'พบความผิดปกติระหว่างการตรวจเช็คตามเกณฑ์มาตรฐาน'}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                              {/* Before Photo Card */}
                              <div className="bg-white border border-red-200 rounded-xl p-2 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-red-700">
                                  <span>ภาพจุดที่พบปัญหา (Before)</span>
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                </div>
                                <div className="aspect-video rounded-lg overflow-hidden border border-red-100 bg-black/5">
                                  <img src={beforePhoto} alt="Before" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  ตรวจพบโดย: {item.latest_inspector || item.responsible_person}
                                </div>
                              </div>

                              {/* After Photo Card */}
                              <div className="bg-white border border-emerald-200 rounded-xl p-2 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700">
                                  <span>ภาพหลังแก้ไขเรียบร้อย (After)</span>
                                  <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                                <div className="aspect-video rounded-lg overflow-hidden border border-emerald-100 bg-black/5">
                                  <img src={afterPhoto} alt="After" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {isFixed ? 'สถานะ: ตรวจสอบซ้ำผ่านเกณฑ์ความปลอดภัยแล้ว' : 'สถานะ: อยู่ระหว่างรอดำเนินการซ่อมแซม'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 7. Signature Section */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
              <div className="space-y-8">
                <div>ลงชื่อ..........................................................</div>
                <div>( เจ้าหน้าที่ความปลอดภัย / ผู้ตรวจสอบ )</div>
                <div className="text-[11px] text-slate-400">วันที่: ......./......./............</div>
              </div>

              <div className="space-y-8">
                <div>ลงชื่อ..........................................................</div>
                <div>( ผู้จัดการแผนก / ประธาน คปอ. )</div>
                <div className="text-[11px] text-slate-400">วันที่: ......./......./............</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
