import React, { useRef, useState } from 'react';
import { Equipment, InspectionRecord } from '../types';
import { SheLogo } from './SheLogo';
import { formatThaiDate, getNowThai, calculateEquipmentAge } from '../utils/thaiDate';
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
import { X, Printer, Download, AlertTriangle, CheckCircle2, Wrench, ShieldCheck, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ReportPreviewModalProps {
  equipmentList: Equipment[];
  inspections: InspectionRecord[];
  reportType: 'MONTHLY' | 'YEARLY';
  selectedPeriod: string;
  barChartData: any;
  doughnutData: any;
  onClose: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  equipmentList,
  inspections,
  reportType,
  selectedPeriod,
  barChartData,
  doughnutData,
  onClose
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const now = getNowThai();

  const total = equipmentList.length;
  const inspected = equipmentList.filter(e => e.inspection_status === 'INSPECTED').length;
  const ready = equipmentList.filter(e => e.ready_status === 'READY').length;
  const defects = equipmentList.filter(e => e.defect_status === 'DEFECT').length;
  const resolved = equipmentList.filter(e => e.defect_status === 'RESOLVED').length;
  const rate = total > 0 ? Math.round((inspected / total) * 100) : 0;

  // Filter items that have defect or resolved issue for Before/After presentation
  const defectItems = equipmentList.filter(
    e => e.defect_status === 'DEFECT' || e.defect_status === 'RESOLVED' || (e.defect_notes && e.defect_notes.trim().length > 0)
  );

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
        position = heightLeft - pdfHeight;
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

            {/* 3. Visual Charts Section (เน้นรูปกราฟเป็นหลัก) */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                <span className="w-2.5 h-2.5 bg-red-600 rounded-sm"></span>
                <span>สรุปผลการตรวจสอบเชิงสถิติ (Charts Overview)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Yearly Bar Chart */}
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
                        animation: false, // disable animation for clean canvas print capture
                        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } }
                      }}
                    />
                  </div>
                </div>

                {/* Monthly Doughnut Chart */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <div className="text-xs font-bold text-slate-700 mb-2 text-center">
                    สัดส่วนผลการตรวจสอบรอบเดือน {selectedPeriod}
                  </div>
                  <div className="h-48 flex items-center justify-center">
                    <Doughnut
                      data={doughnutData}
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
            </div>

            {/* 4. รายการปัญหาและผลการแก้ไข Before / After (เน้นรูปภาพตามที่ผู้ใช้สั่ง) */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-1.5 border-b border-slate-200 pb-1.5">
                <span className="w-2.5 h-2.5 bg-amber-600 rounded-sm"></span>
                <span>รายงานข้อบกพร่องและการแก้ไข พร้อมรูปภาพ Before / After</span>
              </h3>

              {defectItems.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                  <strong>ไม่พบข้อบกพร่องในรอบการตรวจสอบนี้</strong> อุปกรณ์ทุกรายการอยู่ในสภาพพร้อมใช้งานปกติ
                </div>
              ) : (
                <div className="space-y-4">
                  {defectItems.map(item => {
                    const isFixed = item.defect_status === 'RESOLVED';
                    const beforePhoto = item.defect_photo || item.inspection_sheet_photo || 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400';
                    const afterPhoto = item.location_photo || 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?w=400';

                    return (
                      <div
                        key={item.id}
                        className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3"
                      >
                        {/* Header of defect card */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-900">{item.code}</span>
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                              {item.type}
                            </span>
                            <span className="text-xs text-slate-500">สถานที่: {item.location}</span>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isFixed
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {isFixed ? '✓ ได้รับการแก้ไขแล้ว' : '⚠ ยังไม่ได้รับการแก้ไข'}
                          </span>
                        </div>

                        {/* Defect Description */}
                        <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/80">
                          <strong className="text-red-700">ข้อบกพร่องที่พบ:</strong>{' '}
                          {item.defect_notes || 'พบความผิดปกติระหว่างการตรวจเช็คตามเกณฑ์มาตรฐาน'}
                        </div>

                        {/* Before / After Photos Grid */}
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
              )}
            </div>

            {/* 5. Signature Section */}
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
