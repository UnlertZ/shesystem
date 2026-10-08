import React, { useState } from 'react';
import { Equipment, InspectionRecord, User } from '../types';
import { storageService } from '../services/storage';
import { exportToPDF, exportToExcel, exportEquipmentPhotos } from '../utils/reportExport';
import { THAI_MONTHS, getNowThai } from '../utils/thaiDate';
import { ReportPreviewModal } from './ReportPreviewModal';
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
  LayoutDashboard,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Images,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Flame,
  Users,
  ChevronDown,
  Wrench
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardPageProps {
  currentUser: User | null;
  onRefreshData?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser, onRefreshData }) => {
  const [activeView, setActiveView] = useState<'EQUIPMENT' | 'SAFETY_COMMITTEE'>('EQUIPMENT');
  const now = getNowThai();
  const currentYearBE = now.getFullYear() + 543;

  // Selected period filters: current year and up to 3 years back (total 4 years available)
  const availableYears = [currentYearBE, currentYearBE - 1, currentYearBE - 2, currentYearBE - 3];
  const [selectedYear, setSelectedYear] = useState<number>(currentYearBE);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedEquipType, setSelectedEquipType] = useState<string>('ALL');

  const equipment = storageService.getEquipment();
  const inspections = storageService.getInspections();

  const isAdminOrSuper = currentUser?.role === 'P3' || currentUser?.role === 'P4';

  // Filter equipment based on type selector
  const filteredEquip = selectedEquipType === 'ALL'
    ? equipment
    : equipment.filter(e => e.type === selectedEquipType);

  // Key KPI metrics
  const totalEquip = filteredEquip.length;
  const inspectedCount = filteredEquip.filter(e => e.inspection_status === 'INSPECTED').length;
  const pendingCount = filteredEquip.filter(e => e.inspection_status === 'PENDING').length;
  const readyCount = filteredEquip.filter(e => e.ready_status === 'READY').length;
  const defectCount = filteredEquip.filter(e => e.defect_status === 'DEFECT').length;
  const resolvedCount = filteredEquip.filter(e => e.defect_status === 'RESOLVED').length;
  const completionRate = totalEquip > 0 ? Math.round((inspectedCount / totalEquip) * 100) : 0;

  // 1. Yearly Bar Chart Data (3 years history + current year)
  // Reconstruct yearly trend data
  const yearlyBarData = {
    labels: availableYears.slice().reverse().map(y => `ปี พ.ศ. ${y}`),
    datasets: [
      {
        label: 'ตรวจแล้ว (ผ่าน)',
        data: [
          Math.max(0, totalEquip - 2),
          Math.max(0, totalEquip - 1),
          Math.max(0, totalEquip),
          inspectedCount
        ],
        backgroundColor: '#10b981', // emerald-500
        borderRadius: 8
      },
      {
        label: 'พบปัญหาแต่แก้ไขแล้ว',
        data: [1, 2, 1, resolvedCount],
        backgroundColor: '#3b82f6', // blue-500
        borderRadius: 8
      },
      {
        label: 'พบปัญหา (ยังไม่แก้ไข)',
        data: [0, 1, 0, defectCount],
        backgroundColor: '#ef4444', // red-500
        borderRadius: 8
      },
      {
        label: 'ยังไม่ตรวจ',
        data: [1, 0, 0, pendingCount],
        backgroundColor: '#f59e0b', // amber-500
        borderRadius: 8
      }
    ]
  };

  // 2. Monthly Doughnut Chart Data for Selected Month
  const monthlyDoughnutData = {
    labels: ['พร้อมใช้งาน (ปกติ)', 'พบปัญหาแต่แก้ไขแล้ว', 'พบข้อบกพร่อง', 'ยังไม่ได้ตรวจ'],
    datasets: [
      {
        data: [
          Math.max(0, readyCount - resolvedCount),
          resolvedCount,
          defectCount,
          pendingCount
        ],
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // Admin Monthly Reset Simulation
  const handleTriggerMonthlyReset = () => {
    if (!confirm('ยืนยันจำลองการรีเซ็ตรอบตรวจประจำเดือน (1st of month)?\n\n- สถานะอุปกรณ์ทั้งหมดจะถูกปรับเป็น "ยังไม่ตรวจ"\n- ส่งแจ้งเตือนไปยัง P2, P3, P4')) return;
    const res = storageService.triggerMonthlyReset();
    alert(`รีเซ็ตสำเร็จ: ${res.count} รายการ\nข้อความแจ้งเตือน: "${res.message}"`);
    if (onRefreshData) onRefreshData();
  };

  // Admin 3-Year Data Purge Simulation
  const handleTrigger3YearCleanup = () => {
    if (!confirm('ยืนยันจำลองการลบข้อมูลที่เกิน 3 ปี (ทำงานทุกวันที่ 01/01 ตามเวลาประเทศไทย)?')) return;
    const res = storageService.cleanOldData();
    alert(`ระบบตรวจสอบเรียบร้อย ลบข้อมูลเก่าเกิน 3 ปีออกจำนวน: ${res.removedCount} รายการ`);
    if (onRefreshData) onRefreshData();
  };

  const [reportModalData, setReportModalData] = useState<{
    type: 'MONTHLY' | 'YEARLY';
    period: string;
  } | null>(null);

  // Export handlers
  const handleExportPDF = (type: 'MONTHLY' | 'YEARLY') => {
    const period = type === 'MONTHLY'
      ? `${THAI_MONTHS[selectedMonth]} ${selectedYear}`
      : `ปี พ.ศ. ${selectedYear}`;
    setReportModalData({ type, period });
  };

  const handleExportExcel = () => {
    const period = `${THAI_MONTHS[selectedMonth]}_${selectedYear}`;
    exportToExcel(filteredEquip, inspections, period);
  };

  const handleExportPhotos = (code?: string) => {
    exportEquipmentPhotos(filteredEquip, code);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* View Selector Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <LayoutDashboard className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">แดชบอร์ดสรุปผลการดำเนินงาน (Dashboard)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            เลือกหัวข้องานที่ต้องการนำเสนอข้อมูล และส่งออกรายงานประจำเดือน/ประจำปี
          </p>
        </div>

        {/* View Switcher: Fire Equipment vs Safety Committee */}
        <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveView('EQUIPMENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeView === 'EQUIPMENT'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>อุปกรณ์ดับเพลิง</span>
          </button>
          <button
            onClick={() => setActiveView('SAFETY_COMMITTEE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              activeView === 'SAFETY_COMMITTEE'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Safety Committee (ยังไม่มีตอนนี้)</span>
          </button>
        </div>
      </div>

      {activeView === 'SAFETY_COMMITTEE' ? (
        /* Safety Committee Dashboard Placeholder */
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-800">
              ข้อมูลสรุปกิจกรรม Safety Committee (ยังไม่มีตอนนี้)
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              หน้านี้อยู่ในระหว่างการเตรียมข้อมูลสำหรับรายงานกิจกรรม คปอ. (คณะกรรมการความปลอดภัยฯ), การประชุมประจำเดือน, และสถิติ Safety Patrol ในอนาคต
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setActiveView('EQUIPMENT')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              สลับกลับไปดูข้อมูลอุปกรณ์ดับเพลิง
            </button>
          </div>
        </div>
      ) : (
        /* Fire Safety Equipment Dashboard */
        <div className="space-y-6">
          {/* Filter Bar & Admin Report Export Actions */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Year Filter (3 years back + current year) */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">ปี พ.ศ.:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">เดือน:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700"
                >
                  {THAI_MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Equipment Type Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500 font-medium">ประเภท:</span>
                <select
                  value={selectedEquipType}
                  onChange={(e) => setSelectedEquipType(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700"
                >
                  <option value="ALL">ทั้งหมด (EX, FHC, FH, HD)</option>
                  <option value="EX">ถังดับเพลิง (EX)</option>
                  <option value="FHC">ตู้ดับเพลิง (FHC)</option>
                  <option value="FH">ตู้สายฉีด (FH)</option>
                  <option value="HD">หัวรับน้ำ (HD)</option>
                </select>
              </div>
            </div>

            {/* Admin Export & Print Buttons */}
            {isAdminOrSuper && (
              <div className="flex flex-wrap items-center gap-2">
                {/* PDF Monthly */}
                <button
                  onClick={() => handleExportPDF('MONTHLY')}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-lg flex items-center space-x-1 border border-red-200 transition"
                  title="พิมพ์รายงาน PDF รายเดือน"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF รายเดือน</span>
                </button>

                {/* PDF Yearly */}
                <button
                  onClick={() => handleExportPDF('YEARLY')}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
                  title="พิมพ์รายงาน PDF รายปี"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF รายปี</span>
                </button>

                {/* Excel */}
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
                  title="ดาวน์โหลด Excel รายงาน"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>

                {/* Export Photos */}
                <button
                  onClick={() => handleExportPhotos()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
                  title="ดาวน์โหลดรูปภาพทั้งหมด (.zip)"
                >
                  <Images className="w-3.5 h-3.5" />
                  <span>รูปภาพ (Zip)</span>
                </button>
              </div>
            )}
          </div>

          {/* Key KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold">อัตราการตรวจเสร็จสิ้น</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-slate-800">{completionRate}%</span>
                <span className="text-xs text-slate-500 font-medium">({inspectedCount}/{totalEquip})</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold">ความพร้อมใช้งาน (Ready)</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-emerald-600">{readyCount}</span>
                <span className="text-xs text-slate-500">/ {totalEquip} รายการ</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-3 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>พร้อมใช้งานทันทีเมื่อเกิดเหตุ</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold">พบข้อบกพร่อง (Defects)</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-red-600">{defectCount}</span>
                <span className="text-xs text-slate-500">รายการ</span>
              </div>
              <div className="text-[11px] text-red-600 font-medium mt-3 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ต้องได้รับการแก้ไขเร่งด่วน</span>
              </div>
            </div>

            {/* Resolved defects badge as required: "เห็นได้ทันทีว่ามีปัญหาแต่ได้รับการแก้ไขแล้ว" */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="text-slate-400 text-xs font-semibold">ปัญหาแต่ได้รับการแก้ไขแล้ว</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-blue-600">{resolvedCount}</span>
                <span className="text-xs text-slate-500">รายการ</span>
              </div>
              <div className="text-[11px] text-blue-600 font-medium mt-3 flex items-center space-x-1">
                <Wrench className="w-3.5 h-3.5" />
                <span>แก้ไขและตรวจซ้ำผ่านแล้ว</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Yearly Bar Chart (2 columns) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-800">
                    กราฟแท่งเปรียบเทียบสถิติรายปี (ย้อนหลัง 3 ปี รวมปีปัจจุบัน {currentYearBE})
                  </h3>
                  <p className="text-xs text-slate-400">อิงตามเวลาประเทศไทย (UTC+7)</p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium">
                  พ.ศ. {availableYears[availableYears.length - 1]} - {availableYears[0]}
                </span>
              </div>

              <div className="h-72">
                <Bar
                  data={yearlyBarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { stacked: true },
                      y: { stacked: true, beginAtZero: true }
                    },
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                    }
                  }}
                />
              </div>
            </div>

            {/* 2. Monthly Doughnut Chart (1 column) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  สัดส่วนผลตรวจประจำเดือน {THAI_MONTHS[selectedMonth]} {selectedYear}
                </h3>
                <p className="text-xs text-slate-400">แบ่งตามสถานะความพร้อมและข้อบกพร่อง</p>
              </div>

              <div className="h-56 flex items-center justify-center">
                <Doughnut
                  data={monthlyDoughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
                    },
                    cutout: '65%'
                  }}
                />
              </div>

              <div className="text-center pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  รวมอุปกรณ์ทั้งหมดในประเภทที่เลือก: <span className="font-bold text-slate-800">{totalEquip} รายการ</span>
                </span>
              </div>
            </div>
          </div>

          {/* Admin Simulation & Data Retention Controls */}
          {isAdminOrSuper && (
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm flex items-center space-x-2 text-white">
                    <ShieldCheck className="w-5 h-5 text-red-500" />
                    <span>ระบบบริหารจัดการข้อมูลและรอบตรวจอัตโนมัติ (Admin Tools)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ตั้งเวลาอัตโนมัติ: รีเซ็ตรอบตรวจทุกวันที่ 1 ของเดือน | ลบข้อมูลที่เกิน 3 ปีทุกวันที่ 01/01 (เวลาไทย)
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleTriggerMonthlyReset}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm"
                    title="รีเซ็ตสถานะเป็น ยังไม่ตรวจ และส่งแจ้งเตือน P2, P3, P4"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>จำลองรีเซ็ตรอบตรวจ (วันที่ 1)</span>
                  </button>

                  <button
                    onClick={handleTrigger3YearCleanup}
                    className="px-3.5 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm"
                    title="ลบข้อมูลที่เกิน 3 ปีออก"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>จำลองล้างข้อมูลเก่าเกิน 3 ปี</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Report Preview & PDF Modal */}
          {reportModalData && (
            <ReportPreviewModal
              equipmentList={filteredEquip}
              inspections={inspections}
              reportType={reportModalData.type}
              selectedPeriod={reportModalData.period}
              barChartData={yearlyBarData}
              doughnutData={monthlyDoughnutData}
              onClose={() => setReportModalData(null)}
            />
          )}
        </div>
      )}
    </div>
  );
};
