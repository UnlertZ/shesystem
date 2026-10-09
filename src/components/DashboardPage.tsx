import React, { useState, useEffect } from 'react';
import { Equipment, InspectionRecord, User, SafetyPatrolRound, SafetyFinding } from '../types';
import { storageService } from '../services/storage';
import { exportToPDF, exportToExcel, exportEquipmentPhotos } from '../utils/reportExport';
import { THAI_MONTHS, getNowThai } from '../utils/thaiDate';
import { ReportPreviewModal } from './ReportPreviewModal';
import { SafetyPatrolExportModal } from './SafetyPatrolExportModal';
import { PhotoExportModal } from './PhotoExportModal';
import { ExcelExportModal } from './ExcelExportModal';
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
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flame,
  Users,
  ChevronDown,
  Wrench,
  ShieldCheck,
  ThumbsUp,
  AlertCircle,
  Eye,
  ArrowRight,
  ShieldAlert
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

  // Selected period filters: current year and up to 2 years back (total 3 years available: ปีปัจจุบัน + ย้อนหลัง 2 ปี)
  const availableYears = [currentYearBE, currentYearBE - 1, currentYearBE - 2];
  const [selectedYear, setSelectedYear] = useState<number>(currentYearBE);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedEquipType, setSelectedEquipType] = useState<string>('ALL');

  const [equipment, setEquipment] = useState<Equipment[]>(() => storageService.getEquipment());
  const [inspections, setInspections] = useState<InspectionRecord[]>(() => storageService.getInspections());
  const [patrols, setPatrols] = useState<SafetyPatrolRound[]>(() => storageService.getSafetyPatrols());
  const [findings, setFindings] = useState<SafetyFinding[]>(() => storageService.getSafetyFindings());
  const [isSafetyExportModalOpen, setIsSafetyExportModalOpen] = useState(false);
  const [isPhotoExportModalOpen, setIsPhotoExportModalOpen] = useState(false);
  const [isExcelExportModalOpen, setIsExcelExportModalOpen] = useState(false);

  const isCommittee = !!currentUser?.is_safety_committee;

  useEffect(() => {
    if (!isCommittee && activeView === 'SAFETY_COMMITTEE') {
      setActiveView('EQUIPMENT');
    }
  }, [isCommittee, activeView]);

  useEffect(() => {
    const handleSync = () => {
      setEquipment(storageService.getEquipment());
      setInspections(storageService.getInspections());
      setPatrols(storageService.getSafetyPatrols());
      setFindings(storageService.getSafetyFindings());
    };
    window.addEventListener('she_data_synced', handleSync);
    return () => window.removeEventListener('she_data_synced', handleSync);
  }, []);

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

  // 1. Yearly Bar Chart Data (2 years history + current year)
  // Calculate real yearly trend data based on inspections history and current equipment
  const sortedYears = availableYears.slice().reverse();
  const yearlyBarData = {
    labels: sortedYears.map(y => `ปี พ.ศ. ${y}`),
    datasets: [
      {
        label: 'ตรวจแล้ว (ผ่าน)',
        data: sortedYears.map(y => {
          if (y === currentYearBE) return inspectedCount;
          return inspections.filter(i => {
            const inspYear = new Date(i.inspection_date).getFullYear() + 543;
            return inspYear === y && !i.is_abnormal;
          }).length;
        }),
        backgroundColor: '#10b981', // emerald-500
        borderRadius: 8
      },
      {
        label: 'พบปัญหาแต่แก้ไขแล้ว',
        data: sortedYears.map(y => {
          if (y === currentYearBE) return resolvedCount;
          return inspections.filter(i => {
            const inspYear = new Date(i.inspection_date).getFullYear() + 543;
            return inspYear === y && i.is_abnormal && i.defect_resolved;
          }).length;
        }),
        backgroundColor: '#3b82f6', // blue-500
        borderRadius: 8
      },
      {
        label: 'พบปัญหา (ยังไม่แก้ไข)',
        data: sortedYears.map(y => {
          if (y === currentYearBE) return defectCount;
          return inspections.filter(i => {
            const inspYear = new Date(i.inspection_date).getFullYear() + 543;
            return inspYear === y && i.is_abnormal && !i.defect_resolved;
          }).length;
        }),
        backgroundColor: '#ef4444', // red-500
        borderRadius: 8
      },
      {
        label: 'ยังไม่ตรวจ',
        data: sortedYears.map(y => {
          if (y === currentYearBE) return pendingCount;
          return 0;
        }),
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

  // 3. Safety Committee Metrics & Charts (Requirement 4)
  const totalPatrols = patrols.length;
  const openPatrols = patrols.filter(p => p.status === 'OPEN').length;
  const totalFindings = findings.length;
  const recommendFindings = findings.filter(f => f.category === 'RECOMMEND');
  const commendFindings = findings.filter(f => f.category === 'COMMEND');
  const recommendCount = recommendFindings.length;
  const commendCount = commendFindings.length;

  const pendingActionCount = recommendFindings.filter(f => f.status === 'PENDING_ACTION').length;
  const pendingReviewCount = recommendFindings.filter(f => f.status === 'PENDING_REVIEW').length;
  const approvedCount = recommendFindings.filter(f => f.status === 'APPROVED').length;
  const rejectedCount = recommendFindings.filter(f => f.status === 'REJECTED').length;
  const resolutionRate = recommendCount > 0 ? Math.round((approvedCount / recommendCount) * 100) : 0;

  // 1. Latest patrol round for Chart 1 (วงแรกแสดงรอบรายการล่าสุด)
  const sortedPatrols = [...patrols].sort((a, b) => {
    const dateA = a.patrol_date || '';
    const dateB = b.patrol_date || '';
    if (dateB !== dateA) return dateB.localeCompare(dateA);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const latestPatrol = sortedPatrols[0] || null;

  const latestPatrolFindings = latestPatrol
    ? findings.filter(f => f.patrol_id === latestPatrol.id)
    : [];
  const latestRecommendCount = latestPatrolFindings.filter(f => f.category === 'RECOMMEND').length;
  const latestCommendCount = latestPatrolFindings.filter(f => f.category === 'COMMEND').length;
  const latestTotalFindings = latestPatrolFindings.length;

  const categoryDoughnutData = {
    labels: ['ข้อแนะนำ / จุดเสี่ยง (Recommend)', 'เรื่องที่ชมเชย (Commend)'],
    datasets: [
      {
        data: [latestRecommendCount, latestCommendCount],
        backgroundColor: ['#f59e0b', '#10b981'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  // 2. Year-to-Date (ตั้งแต่ มกราคม ถึง เดือนปัจจุบัน) for Chart 2
  const ytdRecommendFindings = recommendFindings.filter(f => {
    let dateStr = f.created_at;
    if (!dateStr && f.patrol_id) {
      const p = patrols.find(item => item.id === f.patrol_id);
      if (p) dateStr = p.patrol_date;
    }
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    return d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth();
  });

  const ytdRecommendCount = ytdRecommendFindings.length;
  const ytdPendingActionCount = ytdRecommendFindings.filter(f => f.status === 'PENDING_ACTION').length;
  const ytdPendingReviewCount = ytdRecommendFindings.filter(f => f.status === 'PENDING_REVIEW').length;
  const ytdApprovedCount = ytdRecommendFindings.filter(f => f.status === 'APPROVED').length;
  const ytdRejectedCount = ytdRecommendFindings.filter(f => f.status === 'REJECTED').length;

  const resolutionDoughnutData = {
    labels: ['แก้ไขสำเร็จ (Approved)', 'รอแอดมินตรวจ (Pending Review)', 'รอดำเนินการ (Pending Action)', 'ส่งกลับไปแก้ใหม่ (Rework)'],
    datasets: [
      {
        data: [ytdApprovedCount, ytdPendingReviewCount, ytdPendingActionCount, ytdRejectedCount],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
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
    setIsExcelExportModalOpen(true);
  };

  const handleExportPhotos = () => {
    setIsPhotoExportModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* View Selector Header */}
      <div className="bg-white p-6 rounded-3xl border border-[#E8DFC8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-[#F7EEDC] text-[#A04830] rounded-xl">
              <LayoutDashboard className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-[#3F3A31]">แดชบอร์ดสรุปผลการดำเนินงาน (Dashboard)</h1>
          </div>
          <p className="text-xs text-[#5C5951] mt-1">
            เลือกหัวข้องานที่ต้องการนำเสนอข้อมูล และส่งออกรายงานประจำเดือน/ประจำปี
          </p>
        </div>

        {/* View Switcher: Fire Equipment vs Safety Committee (Requirement 4: ONLY shown if user is คปอ) */}
        {isCommittee && (
          <div className="inline-flex p-1.5 bg-[#F7EEDC] rounded-2xl border border-[#E8DFC8]">
            <button
              onClick={() => setActiveView('EQUIPMENT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeView === 'EQUIPMENT'
                  ? 'bg-[#A04830] text-white shadow-xs'
                  : 'text-[#5C5951] hover:text-[#3F3A31]'
              }`}
            >
              <Flame className="w-4 h-4" />
              <span>อุปกรณ์ดับเพลิง</span>
            </button>
            <button
              onClick={() => setActiveView('SAFETY_COMMITTEE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                activeView === 'SAFETY_COMMITTEE'
                  ? 'bg-[#3F3A31] text-white shadow-xs'
                  : 'text-[#5C5951] hover:text-[#3F3A31]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#CC902D]" />
              <span>Safety Committee (คปอ.)</span>
            </button>
          </div>
        )}
      </div>

      {activeView === 'SAFETY_COMMITTEE' && isCommittee ? (
        /* Real Safety Committee Dashboard (Requirement 4) */
        <div className="space-y-6">
          {/* Hero / Header stats banner */}
          <div className="bg-linear-to-r from-[#3F3A31] via-[#2D2924] to-[#1F1C18] text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#CC902D]/20 text-[#CC902D] border border-[#CC902D]/30 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>แดชบอร์ดเฉพาะคณะกรรมการ คปอ.</span>
                </div>
                <h2 className="text-2xl font-extrabold">สถิติและความคืบหน้างาน Safety Committee (คปอ.)</h2>
                <p className="text-xs text-[#E8DFC8] mt-1 max-w-xl">
                  สรุปผลการเดินตรวจความปลอดภัย (Safety Walk & Patrol), ข้อเสนอแนะแก้ไขจุดเสี่ยง (Near Miss / Hazards), และการติดตามผล Before & After
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xs text-[#E8DFC8]">อัตราการแก้ไขปัญหาสำเร็จ</div>
                  <div className="text-3xl font-extrabold text-[#CC902D]">{resolutionRate}%</div>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <CheckCircle2 className="w-7 h-7 text-[#CC902D]" />
                </div>
              </div>
            </div>
          </div>

          {/* Key KPI Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#5C5951]">
                <span className="text-xs font-medium">รอบเดินตรวจทั้งหมด</span>
                <Calendar className="w-4 h-4 text-[#A04830]" />
              </div>
              <div className="text-2xl font-extrabold text-[#3F3A31]">{totalPatrols}</div>
              <div className="text-[11px] text-emerald-600 font-semibold">เปิดอยู่ {openPatrols} รอบ</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#5C5951]">
                <span className="text-xs font-medium">รายการตรวจพบทั้งหมด</span>
                <Eye className="w-4 h-4 text-[#3F3A31]" />
              </div>
              <div className="text-2xl font-extrabold text-[#3F3A31]">{totalFindings}</div>
              <div className="text-[11px] text-[#5C5951] font-medium">บันทึกสะสมทั้งหมด</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#5C5951]">
                <span className="text-xs font-medium">ข้อเสนอแนะ / จุดเสี่ยง</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-extrabold text-amber-600">{recommendCount}</div>
              <div className="text-[11px] text-amber-700 font-medium">ต้องติดตามและแก้ไข</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-[#5C5951]">
                <span className="text-xs font-medium">สิ่งที่ชมเชย (Good Practice)</span>
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">{commendCount}</div>
              <div className="text-[11px] text-emerald-700 font-medium">การปฏิบัติงานที่ดี</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E8DFC8] shadow-xs space-y-1 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-[#5C5951]">
                <span className="text-xs font-medium">แก้ไขสำเร็จ (Approved)</span>
                <ShieldCheck className="w-4 h-4 text-[#CC902D]" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-600">{approvedCount}</div>
              <div className="text-[11px] text-[#5C5951] font-medium">
                {pendingReviewCount > 0 ? `รอตรวจ ${pendingReviewCount} รายการ` : 'ไม่มีงานรอตรวจ'}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Category & Problem Status - Latest Patrol Round (วงแรกแสดงรอบรายการล่าสุด) */}
            <div className="bg-white p-6 rounded-3xl border border-[#E8DFC8] shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-[#3F3A31] flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-[#A04830] shrink-0" />
                  <span>สัดส่วนประเภทรายการตรวจพบ (รอบรายการล่าสุด)</span>
                </h3>
                {latestPatrol && (
                  <span
                    className="text-[11px] font-semibold text-[#A04830] bg-[#F7EEDC] border border-[#E8DFC8] px-2.5 py-0.5 rounded-full truncate max-w-[200px]"
                    title={`${latestPatrol.title} (${latestPatrol.patrol_date})`}
                  >
                    {latestPatrol.title}
                  </span>
                )}
              </div>
              {latestTotalFindings === 0 ? (
                <div className="p-12 text-center text-[#5C5951] text-xs">
                  {latestPatrol
                    ? `รอบล่าสุด (${latestPatrol.title}) ยังไม่มีรายการตรวจพบที่บันทึกไว้`
                    : 'ยังไม่มีข้อมูลรอบการเดินตรวจ คปอ.'}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <Doughnut
                    data={categoryDoughnutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Chart 2: Resolution Status - YTD Before-After (วง 2 ตั้งแต่ มกราคม ถึง เดือนปัจจุบัน) */}
            <div className="bg-white p-6 rounded-3xl border border-[#E8DFC8] shadow-xs space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-[#3F3A31] flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#CC902D] shrink-0" />
                  <span>สถานะการติดตามแก้ไขปัญหา Before-After ตั้งแต่ มกราคม ถึง เดือนปัจจุบัน</span>
                </h3>
                <span className="text-[11px] font-bold text-[#3F3A31] bg-[#F7EEDC] border border-[#E8DFC8] px-2.5 py-0.5 rounded-full shrink-0">
                  {ytdRecommendCount} รายการ
                </span>
              </div>
              {ytdRecommendCount === 0 ? (
                <div className="p-12 text-center text-[#5C5951] text-xs">
                  ยังไม่มีรายการข้อแนะนำหรือจุดเสี่ยงตั้งแต่ ม.ค. ถึงเดือนปัจจุบัน ({THAI_MONTHS[now.getMonth()]})
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <Doughnut
                    data={resolutionDoughnutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Recent Patrols Summary Table */}
          <div className="bg-white rounded-3xl border border-[#E8DFC8] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E8DFC8] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#3F3A31]">รอบการเดินตรวจ คปอ. ล่าสุด</h4>
                <p className="text-xs text-[#5C5951]">ข้อมูลรอบเดินตรวจและจำนวนสิ่งที่ตรวจพบ</p>
              </div>
            </div>

            {patrols.length === 0 ? (
              <div className="p-8 text-center text-[#5C5951] text-xs">ยังไม่มีรายการรอบเดินตรวจ คปอ.</div>
            ) : (
              <div className="divide-y divide-[#E8DFC8] text-xs">
                {patrols.slice(0, 5).map(p => {
                  const pFindings = findings.filter(f => f.patrol_id === p.id);
                  const pRecommend = pFindings.filter(f => f.category === 'RECOMMEND').length;
                  const pCommend = pFindings.filter(f => f.category === 'COMMEND').length;
                  return (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7EEDC]/40 transition">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#3F3A31]">{p.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-[#F7EEDC] text-[#5C5951]'
                          }`}>
                            {p.status === 'OPEN' ? 'เปิดรับข้อมูล' : 'ปิดแล้ว'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#5C5951]">
                          วันที่: {p.patrol_date} | เวลา: {p.time_range} | พื้นที่: {p.location || 'ทั่วทั้งโรงงาน'} | สร้างโดย: {p.created_by_name}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-semibold">
                          แนะนำ {pRecommend}
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded-lg font-semibold">
                          ชมเชย {pCommend}
                        </span>
                        <span className="bg-[#F7EEDC] text-[#3F3A31] px-2.5 py-1 rounded-lg font-bold">
                          รวม {pFindings.length} รายการ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Fire Safety Equipment Dashboard */
        <div className="space-y-6">
          {/* Filter Bar & Admin Report Export Actions */}
          <div className="bg-white p-4 rounded-2xl border border-[#E8DFC8] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Year Filter (3 years back + current year) */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[#5C5951] font-medium">ปี พ.ศ.:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-[#FCF9F4] border border-[#E8DFC8] rounded-lg px-2.5 py-1.5 font-bold text-[#3F3A31]"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Month Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[#5C5951] font-medium">เดือน:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-[#FCF9F4] border border-[#E8DFC8] rounded-lg px-2.5 py-1.5 font-bold text-[#3F3A31]"
                >
                  {THAI_MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Equipment Type Filter */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[#5C5951] font-medium">ประเภท:</span>
                <select
                  value={selectedEquipType}
                  onChange={(e) => setSelectedEquipType(e.target.value)}
                  className="bg-[#FCF9F4] border border-[#E8DFC8] rounded-lg px-2.5 py-1.5 font-bold text-[#3F3A31]"
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
                  className="px-3 py-1.5 bg-[#F7EEDC] hover:bg-[#F1E1C1] text-[#A04830] font-semibold rounded-lg flex items-center space-x-1 border border-[#E8DFC8] transition"
                  title="พิมพ์รายงาน PDF รายเดือน"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF รายเดือน</span>
                </button>

                {/* PDF Yearly */}
                <button
                  onClick={() => handleExportPDF('YEARLY')}
                  className="px-3 py-1.5 bg-[#A04830] hover:bg-[#803A26] text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
                  title="พิมพ์รายงาน PDF รายปี"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF รายปี</span>
                </button>

                {/* Excel */}
                <button
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-[#3F3A31] hover:bg-[#2D2924] text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
                  title="ดาวน์โหลด Excel รายงาน"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel (.xlsx)</span>
                </button>

                {/* Export Photos */}
                <button
                  onClick={() => handleExportPhotos()}
                  className="px-3 py-1.5 bg-[#CC902D] hover:bg-[#B57D22] text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
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
            <div className="bg-white p-5 rounded-3xl border border-[#E8DFC8] shadow-xs">
              <div className="text-[#5C5951] text-xs font-semibold">อัตราการตรวจเสร็จสิ้น</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-[#3F3A31]">{completionRate}%</span>
                <span className="text-xs text-[#5C5951] font-medium">({inspectedCount}/{totalEquip})</span>
              </div>
              <div className="w-full bg-[#F7EEDC] h-2 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#E8DFC8] shadow-xs">
              <div className="text-[#5C5951] text-xs font-semibold">ความพร้อมใช้งาน (Ready)</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-emerald-600">{readyCount}</span>
                <span className="text-xs text-[#5C5951]">/ {totalEquip} รายการ</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-3 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>พร้อมใช้งานทันทีเมื่อเกิดเหตุ</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-[#E8DFC8] shadow-xs">
              <div className="text-[#5C5951] text-xs font-semibold">พบข้อบกพร่อง (Defects)</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-red-600">{defectCount}</span>
                <span className="text-xs text-[#5C5951]">รายการ</span>
              </div>
              <div className="text-[11px] text-red-600 font-medium mt-3 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ต้องได้รับการแก้ไขเร่งด่วน</span>
              </div>
            </div>

            {/* Resolved defects badge as required: "เห็นได้ทันทีว่ามีปัญหาแต่ได้รับการแก้ไขแล้ว" */}
            <div className="bg-white p-5 rounded-3xl border border-[#E8DFC8] shadow-xs">
              <div className="text-[#5C5951] text-xs font-semibold">ปัญหาแต่ได้รับการแก้ไขแล้ว</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-3xl font-extrabold text-[#CC902D]">{resolvedCount}</span>
                <span className="text-xs text-[#5C5951]">รายการ</span>
              </div>
              <div className="text-[11px] text-[#CC902D] font-medium mt-3 flex items-center space-x-1">
                <Wrench className="w-3.5 h-3.5" />
                <span>แก้ไขและตรวจซ้ำผ่านแล้ว</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Yearly Bar Chart (2 columns) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-[#E8DFC8] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#3F3A31]">
                    กราฟแท่งเปรียบเทียบสถิติรายปี (ย้อนหลัง 2 ปี รวมปีปัจจุบัน {currentYearBE})
                  </h3>
                  <p className="text-xs text-[#5C5951]">อิงตามเวลาประเทศไทย (UTC+7)</p>
                </div>
                <span className="text-xs bg-[#F7EEDC] text-[#3F3A31] border border-[#E8DFC8] px-2.5 py-1 rounded-lg font-medium">
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
            <div className="bg-white p-6 rounded-3xl border border-[#E8DFC8] shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm text-[#3F3A31]">
                  สัดส่วนผลตรวจประจำเดือน {THAI_MONTHS[selectedMonth]} {selectedYear}
                </h3>
                <p className="text-xs text-[#5C5951]">แบ่งตามสถานะความพร้อมและข้อบกพร่อง</p>
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

              <div className="text-center pt-2 border-t border-[#E8DFC8]">
                <span className="text-xs text-[#5C5951]">
                  รวมอุปกรณ์ทั้งหมดในประเภทที่เลือก: <span className="font-bold text-[#3F3A31]">{totalEquip} รายการ</span>
                </span>
              </div>
            </div>
          </div>

          {/* Report Preview & PDF Modal */}
          {reportModalData && (
            <ReportPreviewModal
              equipmentList={equipment}
              inspections={inspections}
              reportType={reportModalData.type}
              selectedPeriod={reportModalData.period}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              barChartData={yearlyBarData}
              doughnutData={monthlyDoughnutData}
              onClose={() => setReportModalData(null)}
            />
          )}
        </div>
      )}

      {/* Safety Patrol Export Modal (Admin Only) */}
      {isSafetyExportModalOpen && (
        <SafetyPatrolExportModal
          currentUser={currentUser}
          patrols={patrols}
          findings={findings}
          onClose={() => setIsSafetyExportModalOpen(false)}
        />
      )}

      {/* Equipment Photos Export Modal (Admin Only) */}
      {isPhotoExportModalOpen && (
        <PhotoExportModal
          equipmentList={equipment}
          inspections={inspections}
          initialMonth={selectedMonth}
          initialYear={selectedYear}
          initialType={selectedEquipType}
          onClose={() => setIsPhotoExportModalOpen(false)}
        />
      )}

      {/* Excel Export Modal (Admin Only) */}
      {isExcelExportModalOpen && (
        <ExcelExportModal
          equipmentList={equipment}
          inspections={inspections}
          initialMonth={selectedMonth}
          initialYear={selectedYear}
          initialType={selectedEquipType}
          onClose={() => setIsExcelExportModalOpen(false)}
        />
      )}
    </div>
  );
};
