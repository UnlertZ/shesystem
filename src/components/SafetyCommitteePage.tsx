import React, { useState, useEffect } from 'react';
import { User, SafetyPatrolRound, SafetyFinding, SafetyFindingCategory, SafetyFindingSubType, PatrolStatus } from '../types';
import { storageService, uploadToR2 } from '../services/storage';
import {
  ShieldCheck,
  Calendar,
  Clock,
  Plus,
  Lock,
  Unlock,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ThumbsUp,
  X,
  AlertCircle,
  Eye,
  Filter,
  Users,
  Search,
  ArrowRight,
  ShieldAlert,
  Send,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Download,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { formatThaiDate } from '../utils/thaiDate';
import { SafetyPatrolExportModal } from './SafetyPatrolExportModal';

interface SafetyCommitteePageProps {
  currentUser?: User | null;
  onRefreshData?: () => void;
}

export const SafetyCommitteePage: React.FC<SafetyCommitteePageProps> = ({ currentUser, onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<'PATROLS' | 'BEFORE_AFTER' | 'MEMBERS'>('PATROLS');

  const [patrols, setPatrols] = useState<SafetyPatrolRound[]>(() => storageService.getSafetyPatrols());
  const [findings, setFindings] = useState<SafetyFinding[]>(() => storageService.getSafetyFindings());
  const [committeeUsers, setCommitteeUsers] = useState<User[]>(() =>
    storageService.getUsers().filter(u => u.is_safety_committee && u.status === 'approved')
  );

  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Filter & Search states
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [patrolCategoryFilters, setPatrolCategoryFilters] = useState<Record<string, 'ALL' | 'RECOMMEND' | 'COMMEND'>>({});

  const getPatrolFilter = (patrolId: string): 'ALL' | 'RECOMMEND' | 'COMMEND' => {
    return patrolCategoryFilters[patrolId] || 'ALL';
  };

  const setPatrolFilter = (patrolId: string, filter: 'ALL' | 'RECOMMEND' | 'COMMEND') => {
    setPatrolCategoryFilters(prev => ({ ...prev, [patrolId]: filter }));
  };

  // Modals state
  const [isCreatePatrolModalOpen, setIsCreatePatrolModalOpen] = useState(false);
  const [patrolFormDate, setPatrolFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [patrolFormStartTime, setPatrolFormStartTime] = useState('10:00');
  const [patrolFormEndTime, setPatrolFormEndTime] = useState('11:00');
  const [patrolFormTitle, setPatrolFormTitle] = useState('');
  const [patrolFormLocation, setPatrolFormLocation] = useState('ทั่วทั้งโรงงานและสำนักงาน');
  const [patrolFormDesc, setPatrolFormDesc] = useState('');

  // Finding Modal state (Requirement 6)
  const [selectedPatrolForFinding, setSelectedPatrolForFinding] = useState<SafetyPatrolRound | null>(null);
  const [findingCategory, setFindingCategory] = useState<SafetyFindingCategory>('RECOMMEND');
  const [findingSubType, setFindingSubType] = useState<SafetyFindingSubType>('NEAR_MISS');
  const [findingLocation, setFindingLocation] = useState('');
  const [findingDescription, setFindingDescription] = useState('');
  const [findingRecommendation, setFindingRecommendation] = useState('');
  const [findingPhoto, setFindingPhoto] = useState('');
  const [isSubmittingFinding, setIsSubmittingFinding] = useState(false);
  const [findingFormError, setFindingFormError] = useState('');

  // Resolution Modal state (Before & After - Requirement 8)
  const [resolvingFinding, setResolvingFinding] = useState<SafetyFinding | null>(null);
  const [resolveActionTaken, setResolveActionTaken] = useState('');
  const [resolveAfterPhoto, setResolveAfterPhoto] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // Admin Reject/Rework Modal state (Requirement 8)
  const [rejectingFinding, setRejectingFinding] = useState<SafetyFinding | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Full Image Viewer Modal
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

  // Export Safety Patrol Modal (Admin P3 / P4 only)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportInitialPatrolId, setExportInitialPatrolId] = useState<string | undefined>(undefined);

  const isAdmin = currentUser?.role === 'P3' || currentUser?.role === 'P4';

  const [isSyncing, setIsSyncing] = useState(false);

  const refreshAll = async () => {
    setIsSyncing(true);
    try {
      await storageService.syncWithServer();
    } catch (_) {}
    setPatrols(storageService.getSafetyPatrols());
    setFindings(storageService.getSafetyFindings());
    setCommitteeUsers(storageService.getUsers().filter(u => u.is_safety_committee && u.status === 'approved'));
    if (onRefreshData) onRefreshData();
    setIsSyncing(false);
  };

  useEffect(() => {
    const handleSync = () => {
      setPatrols(storageService.getSafetyPatrols());
      setFindings(storageService.getSafetyFindings());
      setCommitteeUsers(storageService.getUsers().filter(u => u.is_safety_committee && u.status === 'approved'));
      if (onRefreshData) onRefreshData();
    };
    window.addEventListener('she_data_synced', handleSync);

    // Initial sync from Cloudflare D1 immediately on mount
    storageService.syncWithServer();

    // Auto-poll D1 every 8 seconds so photos submitted by other users appear live
    const pollInterval = setInterval(() => {
      storageService.syncWithServer();
    }, 8000);

    return () => {
      window.removeEventListener('she_data_synced', handleSync);
      clearInterval(pollInterval);
    };
  }, []);

  // Upload helper using R2 with base64 fallback (auto-compressed to reduce file size)
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadToR2(file);
        setter(url);
      } catch (err) {
        console.error('Upload patrol photo error:', err);
      }
    }
  };

  // 1. Requirement 5: Create Safety Patrol Round (Admin P3 / P4)
  const handleOpenCreatePatrol = () => {
    const today = new Date().toISOString().split('T')[0];
    setPatrolFormDate(today);
    setPatrolFormStartTime('10:00');
    setPatrolFormEndTime('11:00');
    setPatrolFormTitle(`เดินตรวจ คปอ ประจำวันที่ ${today}`);
    setPatrolFormLocation('ทุกแผนกและบริเวณโรงงาน');
    setPatrolFormDesc('สำรวจจุดเสี่ยงอันตราย (Near Miss) และประเมินมาตรฐานความปลอดภัยประจำรอบ');
    setIsCreatePatrolModalOpen(true);
  };

  const handleSavePatrol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patrolFormDate || !patrolFormStartTime || !patrolFormEndTime) return;

    const timeRange = `${patrolFormStartTime}น.-${patrolFormEndTime}น.`;
    const title = patrolFormTitle.trim() || `เดินตรวจ คปอ ประจำวันที่ ${patrolFormDate}`;

    storageService.createSafetyPatrol({
      title,
      patrol_date: patrolFormDate,
      start_time: patrolFormStartTime,
      end_time: patrolFormEndTime,
      time_range: timeRange,
      location: patrolFormLocation.trim() || 'ทั่วทั้งโรงงาน',
      description: patrolFormDesc.trim() || undefined,
      status: 'OPEN',
      created_by_id: currentUser?.id || 'admin',
      created_by_name: currentUser?.full_name || currentUser?.username || 'แอดมิน คปอ.'
    });

    setIsCreatePatrolModalOpen(false);
    refreshAll();
    setBannerMessage({
      type: 'success',
      text: `สร้างรายการเดินตรวจ คปอ. "${title}" (${timeRange}) เรียบร้อยแล้ว`
    });
  };

  // 2. Requirement 7: Toggle Open / Close Patrol Round
  const handleTogglePatrolStatus = (patrol: SafetyPatrolRound) => {
    const nextStatus: PatrolStatus = patrol.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    const actionName = nextStatus === 'CLOSED' ? 'ปิดรายการ' : 'เปิดรายการใหม่';
    const confirmMsg = nextStatus === 'CLOSED'
      ? `คุณต้องการปิดรายการ "${patrol.title}" ใช่หรือไม่?\n\nเมื่อปิดรายการแล้ว สมาชิกจะไม่สามารถกดเข้าร่วมเพื่อเพิ่มรูปภาพหรือบันทึกข้อมูลได้อีก`
      : `คุณต้องการเปิดรายการ "${patrol.title}" อีกครั้งใช่หรือไม่?\n\nเมื่อเปิดรายการแล้ว สมาชิก คปอ. จะสามารถกลับเข้ามาเพิ่มรูปภาพและข้อเสนอแนะได้`;

    if (!confirm(confirmMsg)) return;

    storageService.togglePatrolStatus(patrol.id, nextStatus);
    refreshAll();
    setBannerMessage({
      type: 'success',
      text: `${actionName} "${patrol.title}" เรียบร้อยแล้ว`
    });
  };

  // Delete patrol round (Admin only)
  const handleDeletePatrol = (patrol: SafetyPatrolRound) => {
    if (!confirm(`คุณต้องการลบรายการเดินตรวจ "${patrol.title}" และข้อมูลบันทึกทั้งหมดในรอบนี้ใช่หรือไม่?`)) return;
    storageService.deleteSafetyPatrol(patrol.id);
    refreshAll();
    setBannerMessage({ type: 'info', text: `ลบรายการเดินตรวจ "${patrol.title}" เรียบร้อยแล้ว` });
  };

  // Delete finding item (Admin or reporter)
  const handleDeleteFinding = (finding: SafetyFinding) => {
    const locText = finding.location ? `จุดที่พบ: ${finding.location}` : 'รายการนี้';
    if (!confirm(`คุณต้องการลบข้อมูลสิ่งที่ตรวจพบ "${locText}" ใช่หรือไม่?\n(ข้อมูลรูปภาพและผลการแก้ไขของรายการนี้จะถูกลบออกจากระบบอย่างถาวร)`)) return;
    storageService.deleteSafetyFinding(finding.id);
    refreshAll();
    setBannerMessage({ type: 'info', text: `ลบ ${locText} เรียบร้อยแล้ว` });
  };

  // 3. Requirement 6: Submit Finding (Recommend vs Commend)
  const handleOpenAddFinding = (patrol: SafetyPatrolRound) => {
    if (patrol.status === 'CLOSED') {
      alert('รายการนี้ถูกปิดรับข้อมูลแล้ว ไม่สามารถเพิ่มรูปภาพหรือบันทึกข้อมูลได้');
      return;
    }
    setSelectedPatrolForFinding(patrol);
    setFindingCategory('RECOMMEND');
    setFindingSubType('NEAR_MISS');
    setFindingLocation('');
    setFindingDescription('');
    setFindingRecommendation('');
    setFindingPhoto('');
    setFindingFormError('');
  };

  const handleSaveFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindingFormError('');

    if (!selectedPatrolForFinding) return;

    if (!findingPhoto) {
      setFindingFormError('กรุณาแนบรูปภาพสิ่งที่ตรวจพบทุกครั้ง');
      return;
    }

    if (!findingLocation.trim()) {
      setFindingFormError('กรุณาระบุบริเวณหรือจุดที่ตรวจพบ');
      return;
    }

    if (!findingDescription.trim()) {
      setFindingFormError('กรุณาระบุรายละเอียดสิ่งที่ตรวจพบ');
      return;
    }

    if (findingCategory === 'RECOMMEND' && !findingRecommendation.trim()) {
      setFindingFormError('กรณีเป็นข้อแนะนำ/ความเสี่ยง กรุณาระบุมาตรการป้องกันหรือข้อแนะนำในการแก้ไข');
      return;
    }

    setIsSubmittingFinding(true);

    try {
      const reporterDisplayName = currentUser?.full_name || currentUser?.username || 'สมาชิก คปอ.';

      storageService.createSafetyFinding({
        patrol_id: selectedPatrolForFinding.id,
        category: findingCategory,
        sub_type: findingSubType,
        location: findingLocation.trim(),
        description: findingDescription.trim(),
        recommendation: findingCategory === 'RECOMMEND' ? findingRecommendation.trim() : undefined,
        photo_url: findingPhoto,
        reporter_id: currentUser?.id || 'u_guest',
        reporter_name: reporterDisplayName,
        reporter_department: currentUser?.department || 'คณะกรรมการ คปอ.'
      });

      setSelectedPatrolForFinding(null);
      refreshAll();
      setBannerMessage({
        type: 'success',
        text: `บันทึกรายการ "${findingCategory === 'RECOMMEND' ? 'ข้อแนะนำ/จุดเสี่ยง' : 'ชมเชย'}" บริเวณ ${findingLocation.trim()} เรียบร้อยแล้ว`
      });
    } catch (err: any) {
      setFindingFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmittingFinding(false);
    }
  };

  // 4. Requirement 8: Member Submits Before & After Resolution
  const handleOpenResolveFinding = (finding: SafetyFinding) => {
    setResolvingFinding(finding);
    setResolveActionTaken(finding.action_taken || '');
    setResolveAfterPhoto(finding.after_photo_url || '');
    setResolveError('');
  };

  const handleSaveResolution = (e: React.FormEvent) => {
    e.preventDefault();
    setResolveError('');

    if (!resolvingFinding || !currentUser) return;

    if (!resolveAfterPhoto) {
      setResolveError('กรุณาแนบรูปภาพหลังการแก้ไข (After Photo) ทุกครั้ง');
      return;
    }

    if (!resolveActionTaken.trim()) {
      setResolveError('กรุณาระบุรายละเอียดว่าได้ดำเนินการแก้ไขอย่างไร');
      return;
    }

    setIsSubmittingResolve(true);

    try {
      storageService.resolveSafetyFinding(
        resolvingFinding.id,
        resolveAfterPhoto,
        resolveActionTaken.trim(),
        currentUser
      );

      setResolvingFinding(null);
      refreshAll();
      setBannerMessage({
        type: 'success',
        text: `ส่งผลการแก้ไขปัญหา (Before/After) ของจุด "${resolvingFinding.location}" เรียบร้อยแล้ว รอแอดมินเข้าตรวจสอบ`
      });
    } catch (err: any) {
      setResolveError(err.message || 'เกิดข้อผิดพลาดในการส่งผลแก้ไข');
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // 5. Requirement 8: Admin Reviews (Approve or Reject / Send back to fix again)
  const handleAdminApproveFinding = (finding: SafetyFinding) => {
    if (!currentUser) return;
    if (!confirm(`ยืนยันการอนุมัติ "ผ่าน" สำหรับการแก้ไขปัญหาจุด "${finding.location}"?\n\nสถานะจะเปลี่ยนเป็น "แก้ไขสำเร็จ"`)) return;

    storageService.reviewSafetyFinding(finding.id, true, currentUser);
    refreshAll();
    setBannerMessage({
      type: 'success',
      text: `บันทึกผลการตรวจสอบจุด "${finding.location}" ว่า "ผ่าน (สำเร็จ)" เรียบร้อยแล้ว`
    });
  };

  const handleOpenRejectFinding = (finding: SafetyFinding) => {
    setRejectingFinding(finding);
    setRejectReason('');
    setRejectError('');
  };

  const handleSaveRejectFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingFinding || !currentUser) return;

    if (!rejectReason.trim()) {
      setRejectError('กรุณาระบุเหตุผลที่ไม่ผ่าน และรายละเอียดสิ่งที่ต้องแก้ไขเพิ่มเติม');
      return;
    }

    // Reject and notify the user who performed the resolution
    storageService.reviewSafetyFinding(rejectingFinding.id, false, currentUser, rejectReason.trim());
    setRejectingFinding(null);
    refreshAll();
    setBannerMessage({
      type: 'info',
      text: `ส่งกลับรายการจุด "${rejectingFinding.location}" ให้แก้ไขใหม่ พร้อมส่งการแจ้งเตือนไปยังผู้รับผิดชอบเรียบร้อยแล้ว`
    });
  };

  // Filtered Problem Items for Tab 2 (Before & After)
  const problemItems = findings.filter(f => f.category === 'RECOMMEND');
  const filteredProblemItems = problemItems.filter(item => {
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchSearch = !searchKeyword.trim() ||
      item.location.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.reporter_name.toLowerCase().includes(searchKeyword.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status: SafetyFinding['status']) => {
    switch (status) {
      case 'PENDING_ACTION':
        return <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold">รอดำเนินการแก้ไข</span>;
      case 'PENDING_REVIEW':
        return <span className="bg-blue-100 text-blue-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold animate-pulse">ส่งผลแล้ว รอแอดมินตรวจ</span>;
      case 'APPROVED':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><span>ผ่าน (แก้ไขสำเร็จ)</span></span>;
      case 'REJECTED':
        return <span className="bg-red-100 text-red-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1"><AlertCircle className="w-3.5 h-3.5 text-red-600" /><span>ไม่ผ่าน (ส่งกลับไปแก้ใหม่)</span></span>;
      case 'COMMENDED':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1"><ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /><span>เรื่องที่ชมเชย</span></span>;
      default:
        return <span className="bg-slate-100 text-slate-600 text-[11px] px-2.5 py-0.5 rounded-full font-medium">{status}</span>;
    }
  };

  const getSubTypeLabel = (subType?: string) => {
    switch (subType) {
      case 'NEAR_MISS':
        return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-semibold">เกือบเกิดอุบัติเหตุ (Near Miss)</span>;
      case 'ACCIDENT':
        return <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-semibold">อุบัติเหตุ (Accident)</span>;
      case 'UNSAFE_CONDITION':
        return <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-semibold">สภาพที่ไม่ปลอดภัย</span>;
      case 'UNSAFE_ACT':
        return <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-semibold">การกระทำที่ไม่ปลอดภัย</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hero Header Card - JDE Peet's Coffee Roast & Terracotta Accent */}
      <div className="bg-linear-to-r from-[#3F3A31] via-[#2D2924] to-[#1F1C18] text-[#FCF9F4] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-[#8C7454]/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-[#CC902D]/20 text-[#E8D5B0] border border-[#CC902D]/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#CC902D]" />
              <span>Safety Committee Portal (คปอ.)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              ระบบบริหารจัดการงานคณะกรรมการ คปอ.
            </h1>

            <p className="text-[#E8D5B0] text-xs sm:text-sm leading-relaxed">
              แบบฟอร์มบันทึกการเดินตรวจความปลอดภัย (Safety Walk & Patrol), แนบรูปภาพข้อแนะนำ (Near Miss) และเรื่องที่ชมเชย พร้อมระบบติดตามผลการแก้ไขแบบ Before & After
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setExportInitialPatrolId('ALL');
                    setIsExportModalOpen(true);
                  }}
                  className="px-3.5 py-2.5 bg-[#2D2924] hover:bg-[#1F1C18] text-[#FCF9F4] rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-2 shrink-0 border border-[#8C7454]/50"
                  title="Export รายงานการเดินตรวจ คปอ. (PDF, Excel, รูปภาพ)"
                >
                  <Download className="w-4 h-4 text-[#CC902D]" />
                  <span>Export รายงาน คปอ.</span>
                </button>

                <button
                  onClick={handleOpenCreatePatrol}
                  className="px-4 py-2.5 bg-[#A04830] hover:bg-[#803A26] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#A04830]/30 transition flex items-center space-x-2 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ สร้างรายการเดินตรวจ คปอ.</span>
                </button>
              </>
            )}

            <button
              onClick={refreshAll}
              disabled={isSyncing}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition disabled:opacity-50"
              title="รีเฟรชข้อมูล (Sync กับเซิร์ฟเวอร์ Cloudflare D1)"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Banner Message */}
      {bannerMessage && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in ${
          bannerMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          bannerMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center space-x-2">
            {bannerMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{bannerMessage.text}</span>
          </div>
          <button onClick={() => setBannerMessage(null)} className="text-slate-400 hover:text-slate-700 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('PATROLS')}
          className={`px-4 py-3 text-xs font-bold rounded-t-2xl transition flex items-center space-x-2 ${
            activeTab === 'PATROLS'
              ? 'border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>รอบการเดินตรวจ คปอ. (Patrol Rounds)</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {patrols.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('BEFORE_AFTER')}
          className={`px-4 py-3 text-xs font-bold rounded-t-2xl transition flex items-center space-x-2 ${
            activeTab === 'BEFORE_AFTER'
              ? 'border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>ติดตาม / แก้ไขปัญหา Before-After</span>
          {problemItems.filter(p => p.status === 'PENDING_ACTION' || p.status === 'PENDING_REVIEW').length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {problemItems.filter(p => p.status === 'PENDING_ACTION' || p.status === 'PENDING_REVIEW').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`px-4 py-3 text-xs font-bold rounded-t-2xl transition flex items-center space-x-2 ${
            activeTab === 'MEMBERS'
              ? 'border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>ทำเนียบคณะกรรมการ คปอ.</span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
            {committeeUsers.length} คน
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: Patrol Rounds (รอบเดินตรวจ คปอ.)                        */}
      {/* ============================================================== */}
      {activeTab === 'PATROLS' && (
        <div className="space-y-6">
          {patrols.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-base text-slate-700">ยังไม่มีรายการรอบเดินตรวจ คปอ.</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isAdmin
                  ? 'กดปุ่ม "+ สร้างรายการเดินตรวจ คปอ." ด้านบนเพื่อเริ่มกำหนดวันและเวลาเดินตรวจความปลอดภัย'
                  : 'ยังไม่มีรอบเดินตรวจที่เปิดใช้งานในขณะนี้ กรุณารอแอดมินกำหนดวันเวลาตรวจ'}
              </p>
              {isAdmin && (
                <button
                  onClick={handleOpenCreatePatrol}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700"
                >
                  + สร้างรายการเดินตรวจแรก
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {patrols.map(patrol => {
                const patrolFindings = findings.filter(f => 
                  f.patrol_id === patrol.id ||
                  (f.patrol_id === 'patrol_1791525622145' && patrol.id === 'patrol_1791525622470') ||
                  (f.patrol_id && patrol.id && Math.abs(Number(f.patrol_id.replace(/\D/g, '')) - Number(patrol.id.replace(/\D/g, ''))) < 10000)
                );
                const recommendCount = patrolFindings.filter(f => f.category === 'RECOMMEND').length;
                const commendCount = patrolFindings.filter(f => f.category === 'COMMEND').length;
                const isOpen = patrol.status === 'OPEN';
                const currentPatrolCategory = getPatrolFilter(patrol.id);
                const displayedFindings = patrolFindings.filter(f => {
                  if (currentPatrolCategory === 'RECOMMEND') return f.category === 'RECOMMEND';
                  if (currentPatrolCategory === 'COMMEND') return f.category === 'COMMEND';
                  return true;
                });

                return (
                  <div
                    key={patrol.id}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition"
                  >
                    {/* Patrol Card Header */}
                    <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-800">{patrol.title}</h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center space-x-1 ${
                              isOpen
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-600 animate-pulse' : 'bg-slate-500'}`} />
                            <span>{isOpen ? 'เปิดรับข้อมูล (Active)' : 'ปิดรับข้อมูลแล้ว (Closed)'}</span>
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-y-1 gap-x-4">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>วันที่: <strong className="text-slate-700">{patrol.patrol_date}</strong></span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>เวลา: <strong className="text-slate-700">{patrol.time_range}</strong></span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-slate-400">พื้นที่:</span>
                            <span className="text-slate-700 font-medium">{patrol.location || 'ทั่วทั้งโรงงาน'}</span>
                          </div>
                        </div>

                        {patrol.description && (
                          <p className="text-xs text-slate-600 pt-0.5">{patrol.description}</p>
                        )}
                      </div>

                      {/* Action buttons on this patrol */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
                        {/* Requirement 6: Member button to join / add findings */}
                        {isOpen ? (
                          <button
                            onClick={() => handleOpenAddFinding(patrol)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
                          >
                            <Camera className="w-4 h-4" />
                            <span>เข้าร่วม / บันทึกข้อมูล (+ เพิ่มรูป)</span>
                          </button>
                        ) : (
                          <div className="px-3.5 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold border border-slate-200 flex items-center space-x-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>ปิดรับข้อมูลแล้ว</span>
                          </div>
                        )}

                        {/* Requirement 7: Admin button to Open / Close round */}
                        {isAdmin && (
                          <button
                            onClick={() => handleTogglePatrolStatus(patrol)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-1 ${
                              isOpen
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                            title={isOpen ? 'กดเพื่อปิดไม่ให้เพิ่มรูปได้อีก' : 'กดเพื่อเปิดให้สมาชิกเข้ามาเพิ่มรูปได้อีก'}
                          >
                            {isOpen ? (
                              <>
                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                <span>ปิดรายการ</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>เปิดรายการใหม่</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Export specific patrol round (Admin only) */}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setExportInitialPatrolId(patrol.id);
                              setIsExportModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center space-x-1 shadow-2xs"
                            title="Export รายงานสำหรับรอบเดินตรวจนี้ (PDF, Excel, รูปภาพ)"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Export</span>
                          </button>
                        )}

                        {/* Delete patrol (Admin only) */}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeletePatrol(patrol)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                            title="ลบรายการเดินตรวจ"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter & Stats bar */}
                    <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-400 font-semibold mr-1 flex items-center space-x-1">
                          <Filter className="w-3.5 h-3.5" />
                          <span>ตัวกรอง:</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => setPatrolFilter(patrol.id, 'ALL')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs ${
                            currentPatrolCategory === 'ALL'
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <span>ทั้งหมด</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            currentPatrolCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {patrolFindings.length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPatrolFilter(patrol.id, 'RECOMMEND')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs ${
                            currentPatrolCategory === 'RECOMMEND'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
                          }`}
                        >
                          <AlertTriangle className={`w-3.5 h-3.5 ${currentPatrolCategory === 'RECOMMEND' ? 'text-white' : 'text-amber-600'}`} />
                          <span>ข้อเสนอแนะ / จุดเสี่ยง</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            currentPatrolCategory === 'RECOMMEND' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {recommendCount}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPatrolFilter(patrol.id, 'COMMEND')}
                          className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs ${
                            currentPatrolCategory === 'COMMEND'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${currentPatrolCategory === 'COMMEND' ? 'text-white' : 'text-emerald-600'}`} />
                          <span>เรื่องที่ชมเชย</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                            currentPatrolCategory === 'COMMEND' ? 'bg-white/25 text-white' : 'bg-emerald-200 text-emerald-900'
                          }`}>
                            {commendCount}
                          </span>
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-400">
                        สร้างโดย: {patrol.created_by_name}
                      </span>
                    </div>

                    {/* Findings list inside this patrol round */}
                    <div className="p-5 sm:p-6">
                      {displayedFindings.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs space-y-1.5">
                          {patrolFindings.length === 0 ? (
                            <div>ยังไม่มีการบันทึกรายการในรอบเดินตรวจนี้ {isOpen && '(สามารถกดปุ่ม "เข้าร่วม / บันทึกข้อมูล" เพื่อเริ่มแนบรูป)'}</div>
                          ) : (
                            <div>
                              <span>ไม่พบรายการในหมวดที่เลือก ({currentPatrolCategory === 'RECOMMEND' ? 'ข้อเสนอแนะ/จุดเสี่ยง' : 'เรื่องที่ชมเชย'}) </span>
                              <button
                                type="button"
                                onClick={() => setPatrolFilter(patrol.id, 'ALL')}
                                className="text-emerald-600 font-bold underline hover:text-emerald-700 ml-1 cursor-pointer"
                              >
                                ดูทั้งหมด ({patrolFindings.length} รายการ)
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {displayedFindings.map(finding => (
                            <div
                              key={finding.id}
                              className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition ${
                                finding.category === 'RECOMMEND'
                                  ? 'bg-amber-50/20 border-amber-200'
                                  : 'bg-emerald-50/20 border-emerald-200'
                              }`}
                            >
                              <div>
                                {/* Header / Badge */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-1.5">
                                    {finding.category === 'RECOMMEND' ? (
                                      <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                        <span>แนะนำ / จุดเสี่ยง</span>
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                                        <ThumbsUp className="w-3 h-3 text-emerald-600" />
                                        <span>ชมเชย</span>
                                      </span>
                                    )}
                                    {getSubTypeLabel(finding.sub_type)}
                                  </div>

                                  <div className="flex items-center space-x-1.5">
                                    {getStatusBadge(finding.status)}
                                    {(isAdmin || currentUser?.id === finding.reporter_id) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFinding(finding);
                                        }}
                                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="ลบรายการนี้"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Finding Photo */}
                                <div
                                  onClick={() => setViewingImage({ url: finding.photo_url, title: `จุดตรวจ: ${finding.location}` })}
                                  className="relative aspect-video rounded-xl overflow-hidden bg-black/5 border border-slate-200 cursor-pointer group mb-2.5"
                                >
                                  <img
                                    src={finding.photo_url}
                                    alt={finding.location}
                                    className="w-full h-full object-cover group-hover:scale-105 transition"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                                    <Eye className="w-4 h-4 mr-1" />
                                    <span>คลิกดูภาพขยาย</span>
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="space-y-1.5 text-xs">
                                  <div className="font-bold text-slate-800">
                                    จุดที่พบ: <span className="text-slate-700 font-medium">{finding.location}</span>
                                  </div>

                                  <div>
                                    <span className="font-semibold text-slate-600">
                                      {finding.category === 'RECOMMEND' ? 'รายละเอียดอันตราย / ความเสี่ยง:' : 'รายละเอียดการชมเชย:'}
                                    </span>
                                    <p className="text-slate-700 mt-0.5 line-clamp-3">{finding.description}</p>
                                  </div>

                                  {finding.recommendation && (
                                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                                      <span className="font-bold">มาตรการป้องกัน/แก้ไข:</span>
                                      <p className="mt-0.5">{finding.recommendation}</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Footer / Reporter info & Before/After Shortcut */}
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                <span>โดย: <strong className="text-slate-600">{finding.reporter_name}</strong></span>
                                {finding.category === 'RECOMMEND' && (
                                  <button
                                    onClick={() => {
                                      setActiveTab('BEFORE_AFTER');
                                      setSearchKeyword(finding.location);
                                    }}
                                    className="text-emerald-700 font-bold hover:underline flex items-center space-x-0.5"
                                  >
                                    <span>ดู Before-After</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: Before & After Action Tracking (Requirement 8)          */}
      {/* ============================================================== */}
      {activeTab === 'BEFORE_AFTER' && (
        <div className="space-y-6">
          {/* Header Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-600 flex items-center space-x-1 mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>สถานะ:</span>
              </span>
              {[
                { id: 'ALL', label: 'ทั้งหมด' },
                { id: 'PENDING_ACTION', label: 'รอดำเนินการแก้ไข' },
                { id: 'PENDING_REVIEW', label: 'รอแอดมินตรวจ' },
                { id: 'APPROVED', label: 'แก้ไขสำเร็จ (ผ่าน)' },
                { id: 'REJECTED', label: 'ส่งกลับไปแก้ใหม่' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    statusFilter === f.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="ค้นหาจุดตรวจ / ผู้รายงาน..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs"
              />
            </div>
          </div>

          {/* List of Problem Items with Side-by-Side Before & After */}
          {filteredProblemItems.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-base text-slate-700">ไม่มีรายการปัญหาที่ตรงกับเงื่อนไขการค้นหา</h3>
              <p className="text-xs text-slate-400">
                เมื่อสมาชิก คปอ. บันทึกข้อเสนอแนะหรือจุดเสี่ยงในรอบเดินตรวจ รายการจะมาปรากฏในหน้านี้เพื่อให้แนบรูปแก้ไข Before & After
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredProblemItems.map(item => {
                const isApproved = item.status === 'APPROVED';
                const isRejected = item.status === 'REJECTED';
                const isPendingReview = item.status === 'PENDING_REVIEW';
                const isPendingAction = item.status === 'PENDING_ACTION';

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition"
                  >
                    {/* Problem Card Top Bar */}
                    <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 text-sm">จุดที่พบ: {item.location}</span>
                          {getStatusBadge(item.status)}
                          {getSubTypeLabel(item.sub_type)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          ผู้รายงาน: <strong className="text-slate-700">{item.reporter_name}</strong> ({item.reporter_department || 'คปอ.'}) | บันทึกเมื่อ: {formatThaiDate(item.created_at, true)}
                        </div>
                      </div>

                      {/* Admin Quick Decision or Member Action */}
                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Member Action: Attach After photo if pending action or rejected */}
                        {(isPendingAction || isRejected) && (
                          <button
                            onClick={() => handleOpenResolveFinding(item)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition flex items-center space-x-1"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{isRejected ? 'ส่งผลการแก้ไขใหม่' : 'แนบรูปการแก้ไข (Before/After)'}</span>
                          </button>
                        )}

                        {/* Admin Action: Approve / Reject (Requirement 8) */}
                        {isAdmin && isPendingReview && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleAdminApproveFinding(item)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition flex items-center space-x-1"
                              title="อนุมัติการแก้ไขเป็นผ่าน"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ผ่าน (กดสำเร็จ)</span>
                            </button>

                            <button
                              onClick={() => handleOpenRejectFinding(item)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold transition flex items-center space-x-1"
                              title="ส่งกลับไปให้แก้ไขใหม่"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>ไม่ผ่าน (ส่งกลับไปแก้ใหม่)</span>
                            </button>
                          </div>
                        )}

                        {/* Delete Finding (Admin or Creator) */}
                        {(isAdmin || currentUser?.id === item.reporter_id) && (
                          <button
                            onClick={() => handleDeleteFinding(item)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition ml-1"
                            title="ลบรายการนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rejection Notice Banner if REJECTED */}
                    {isRejected && item.reject_reason && (
                      <div className="p-3 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-start space-x-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">ผลการตรวจไม่ผ่านจากแอดมิน ({item.reviewed_by_name || 'แอดมิน'}):</span>
                          <p className="mt-0.5">{item.reject_reason}</p>
                          <p className="text-[11px] text-red-600 mt-1 font-semibold">
                            * กรุณาดำเนินการแก้ไขเพิ่มเติมตามคำแนะนำ และกดปุ่ม &quot;ส่งผลการแก้ไขใหม่&quot; ด้านบน
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Approval Notice Banner if APPROVED */}
                    {isApproved && (
                      <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>ได้รับการตรวจสอบและอนุมัติผ่านเรียบร้อยแล้ว โดย <strong>{item.reviewed_by_name || 'แอดมิน'}</strong></span>
                        </div>
                        {item.reviewed_at && (
                          <span className="text-[11px] text-emerald-700">{formatThaiDate(item.reviewed_at, true)}</span>
                        )}
                      </div>
                    )}

                    {/* Side-by-Side Comparison: Before vs After */}
                    <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: BEFORE Photo & Details */}
                      <div className="space-y-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>ก่อนแก้ไข (Before)</span>
                          </span>
                        </div>

                        <div
                          onClick={() => setViewingImage({ url: item.photo_url, title: `ก่อนแก้ไข: ${item.location}` })}
                          className="relative aspect-video rounded-xl overflow-hidden bg-black/5 border border-slate-200 cursor-pointer group"
                        >
                          <img
                            src={item.photo_url}
                            alt="ก่อนแก้ไข"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                            <Eye className="w-4 h-4 mr-1" />
                            <span>คลิกดูภาพขยาย</span>
                          </div>
                        </div>

                        <div className="text-xs space-y-1.5 text-slate-700">
                          <div>
                            <span className="font-bold text-slate-800">อันตราย / ความเสี่ยงที่พบ:</span>
                            <p className="mt-0.5 text-slate-600">{item.description}</p>
                          </div>
                          {item.recommendation && (
                            <div>
                              <span className="font-bold text-amber-900">มาตรการที่แนะนำ:</span>
                              <p className="mt-0.5 text-amber-800">{item.recommendation}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: AFTER Photo & Resolution Details */}
                      <div className="space-y-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>หลังแก้ไข (After)</span>
                            </span>
                            {item.resolved_by_name && (
                              <span className="text-[11px] text-slate-500">
                                ผู้แก้ไข: <strong className="text-slate-700">{item.resolved_by_name}</strong>
                              </span>
                            )}
                          </div>

                          {item.after_photo_url ? (
                            <div
                              onClick={() => setViewingImage({ url: item.after_photo_url!, title: `หลังแก้ไข: ${item.location}` })}
                              className="relative aspect-video rounded-xl overflow-hidden bg-black/5 border border-slate-200 cursor-pointer group"
                            >
                              <img
                                src={item.after_photo_url}
                                alt="หลังแก้ไข"
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                                <Eye className="w-4 h-4 mr-1" />
                                <span>คลิกดูภาพขยาย</span>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-video rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                              <Camera className="w-8 h-8 text-slate-300 mb-1" />
                              <span className="font-semibold text-slate-500">ยังไม่มีการส่งผลการแก้ไข</span>
                              <span className="text-[11px] text-slate-400 mt-1">ผู้รับผิดชอบหรือสมาชิก คปอ. สามารถกดแนบรูปเพื่อส่งตรวจ</span>
                              <button
                                onClick={() => handleOpenResolveFinding(item)}
                                className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                              >
                                + แนบรูปผลการแก้ไข
                              </button>
                            </div>
                          )}

                          {item.action_taken && (
                            <div className="mt-3 text-xs space-y-1 text-slate-700">
                              <span className="font-bold text-slate-800">รายละเอียดการแก้ไข:</span>
                              <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200">
                                {item.action_taken}
                              </p>
                              {item.resolved_at && (
                                <span className="text-[10px] text-slate-400 block pt-0.5">
                                  แก้ไขเมื่อ: {formatThaiDate(item.resolved_at, true)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Admin Action shortcut if pending review */}
                        {isAdmin && isPendingReview && (
                          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleAdminApproveFinding(item)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                            >
                              ผ่าน (กดสำเร็จ)
                            </button>
                            <button
                              onClick={() => handleOpenRejectFinding(item)}
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl text-xs font-bold transition"
                            >
                              ไม่ผ่าน (ส่งแก้ใหม่)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: Committee Members (ทำเนียบคณะกรรมการ คปอ.)             */}
      {/* ============================================================== */}
      {activeTab === 'MEMBERS' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-800">รายชื่อคณะกรรมการความปลอดภัย อาชีวอนามัย (คปอ.)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                สมาชิกที่ได้รับแต่งตั้งเป็น คปอ. จะมีสิทธิ์เข้าถึงหน้านี้และสามารถเข้าร่วมบันทึกการเดินตรวจได้ (แอดมิน P3 สามารถแต่งตั้ง/ถอดถอนได้ที่หน้าจัดการสมาชิก)
              </p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
              รวม {committeeUsers.length} ท่าน
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {committeeUsers.map(user => {
              const userFindingsCount = findings.filter(f => f.reporter_id === user.id).length;
              const userResolvedCount = findings.filter(f => f.resolved_by_id === user.id && f.status === 'APPROVED').length;

              return (
                <div
                  key={user.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 hover:shadow-md transition"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt={user.username}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                        <span>{user.full_name || user.username}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          คปอ.
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">{user.position}</div>
                      <div className="text-[11px] text-slate-400">{user.department}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <div className="text-[10px] text-slate-400">บันทึกตรวจพบ</div>
                      <div className="text-sm font-bold text-slate-800">{userFindingsCount} เรื่อง</div>
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded-xl">
                      <div className="text-[10px] text-emerald-600">แก้ไขสำเร็จ</div>
                      <div className="text-sm font-bold text-emerald-700">{userResolvedCount} เรื่อง</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: Create Patrol Round (Requirement 5)                   */}
      {/* ============================================================== */}
      {isCreatePatrolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-800">สร้างรายการเดินตรวจ คปอ. (รอบใหม่)</h3>
                  <p className="text-xs text-slate-400">กำหนดวันและเวลาเดินตรวจเพื่อเปิดรับการบันทึกข้อมูล</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreatePatrolModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePatrol} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">หัวข้อ / ชื่อรอบการเดินตรวจ *</label>
                <input
                  type="text"
                  value={patrolFormTitle}
                  onChange={(e) => setPatrolFormTitle(e.target.value)}
                  placeholder="เช่น เดินตรวจ คปอ ประจำวันที่ 10/10/2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">วันที่เดินตรวจ *</label>
                  <input
                    type="date"
                    value={patrolFormDate}
                    onChange={(e) => setPatrolFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เวลาเริ่ม (Start) *</label>
                  <input
                    type="time"
                    value={patrolFormStartTime}
                    onChange={(e) => setPatrolFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เวลาสิ้นสุด (End) *</label>
                  <input
                    type="time"
                    value={patrolFormEndTime}
                    onChange={(e) => setPatrolFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">พื้นที่ / โซนเป้าหมายในการเดินตรวจ</label>
                <input
                  type="text"
                  value={patrolFormLocation}
                  onChange={(e) => setPatrolFormLocation(e.target.value)}
                  placeholder="เช่น สายการผลิต 1-2, คลังสินค้า A, อาคารสำนักงาน"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วัตถุประสงค์ / หมายเหตุเพิ่มเติม</label>
                <textarea
                  value={patrolFormDesc}
                  onChange={(e) => setPatrolFormDesc(e.target.value)}
                  rows={2}
                  placeholder="เช่น เน้นการตรวจสอบจุดเสี่ยงสารเคมี และการสวมใส่อุปกรณ์ PPE..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreatePatrolModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 transition flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกและเปิดรอบเดินตรวจ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: Add Finding (Recommend vs Commend - Requirement 6)    */}
      {/* ============================================================== */}
      {selectedPatrolForFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-slate-800">บันทึกผลการเดิน คปอ.</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {selectedPatrolForFinding.patrol_date}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">รอบเวลา: {selectedPatrolForFinding.time_range}</p>
              </div>
              <button
                onClick={() => setSelectedPatrolForFinding(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinding} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {findingFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{findingFormError}</span>
                </div>
              )}

              {/* Category Selection: แนะนำ vs ชมเชย (Requirement 6) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-2">เลือกประเภทรายการตรวจพบ *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFindingCategory('RECOMMEND')}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center space-x-3 ${
                      findingCategory === 'RECOMMEND'
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">แนะนำ / จุดเสี่ยง</div>
                      <div className="text-[11px] text-slate-500">Near Miss, อุบัติเหตุ, ข้อเสนอแนะแก้ไข</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFindingCategory('COMMEND')}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-center space-x-3 ${
                      findingCategory === 'COMMEND'
                        ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                      <ThumbsUp className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">ชมเชย (Good Practice)</div>
                      <div className="text-[11px] text-slate-500">การปฏิบัติที่ถูกต้อง, สภาพแวดล้อมดีเด่น</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-type for Recommend */}
              {findingCategory === 'RECOMMEND' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">ประเภทย่อยของความเสี่ยง</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'NEAR_MISS', label: 'เกือบเกิดอุบัติเหตุ (Near Miss)' },
                      { id: 'ACCIDENT', label: 'อุบัติเหตุ (Accident)' },
                      { id: 'UNSAFE_CONDITION', label: 'สภาพที่ไม่ปลอดภัย (Unsafe Condition)' },
                      { id: 'UNSAFE_ACT', label: 'การกระทำที่ไม่ปลอดภัย (Unsafe Act)' }
                    ].map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setFindingSubType(sub.id as any)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] ${
                          findingSubType === sub.id
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Photo Upload */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ถ่ายรูป / แนบรูปภาพ {findingCategory === 'RECOMMEND' ? 'จุดเสี่ยง (Before Photo)' : 'สิ่งที่ชมเชย'} *
                </label>
                {findingPhoto ? (
                  <div className="relative aspect-video max-h-52 rounded-2xl overflow-hidden bg-black/5 border border-slate-200">
                    <img src={findingPhoto} alt="รูปที่ตรวจพบ" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFindingPhoto('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full text-xs shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl aspect-video max-h-48 flex flex-col items-center justify-center cursor-pointer transition bg-slate-50/50">
                    <Upload className="w-7 h-7 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-600 font-semibold">กดเพื่อถ่ายรูป หรือ อัปโหลดรูปภาพ</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">รองรับ JPG, PNG (ระบบลดขนาดไฟล์อัตโนมัติเพื่อประหยัดพื้นที่)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(e, setFindingPhoto)}
                    />
                  </label>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">บริเวณ / จุดที่พบ *</label>
                <input
                  type="text"
                  value={findingLocation}
                  onChange={(e) => setFindingLocation(e.target.value)}
                  placeholder="เช่น ทางเดินหน้าแผนกบรรจุหีบห่อ, ตู้ควบคุมไฟหลัก A"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {findingCategory === 'RECOMMEND'
                    ? 'ระบุอันตรายหรือความเสี่ยงที่พบ *'
                    : 'ระบุรายละเอียดสิ่งที่ชมเชย (ชมอย่างไร / พฤติกรรมที่ดีที่พบ) *'}
                </label>
                <textarea
                  value={findingDescription}
                  onChange={(e) => setFindingDescription(e.target.value)}
                  rows={3}
                  placeholder={
                    findingCategory === 'RECOMMEND'
                      ? 'เช่น พบสายไฟมีรอยฉีกขาดใกล้ท่อน้ำ เสี่ยงต่อการเกิดไฟฟ้าลัดวงจรและไฟไหม้...'
                      : 'เช่น พนักงานสวมใส่อุปกรณ์ PPE ครบถ้วนถูกต้อง 100% และมีการจัดเก็บสารเคมีเข้าตู้เซฟตี้เรียบร้อย...'
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Recommendation (Only for Recommend) */}
              {findingCategory === 'RECOMMEND' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ระบุมาตรการป้องกัน / คำแนะนำในการแก้ไข *
                  </label>
                  <textarea
                    value={findingRecommendation}
                    onChange={(e) => setFindingRecommendation(e.target.value)}
                    rows={2}
                    placeholder="เช่น ให้แผนกซ่อมบำรุงดำเนินการพันฉนวนหรือเปลี่ยนสายไฟเส้นใหม่ และติดตั้งท่อร้อยสายไฟ..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end space-x-2 shrink-0 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedPatrolForFinding(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFinding}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 transition flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingFinding ? 'กำลังบันทึก...' : 'บันทึกข้อมูลการตรวจ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: Submit Before & After Resolution (Requirement 8)      */}
      {/* ============================================================== */}
      {resolvingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-base text-slate-800">แนบรูปภาพผลการแก้ไข (Before & After)</h3>
                <p className="text-xs text-slate-400 mt-0.5">จุดตรวจ: {resolvingFinding.location}</p>
              </div>
              <button
                onClick={() => setResolvingFinding(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResolution} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {resolveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* Before Reference Photo Box */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="font-bold text-slate-700 block mb-1.5">รูปก่อนแก้ไข (Before):</span>
                <div className="flex items-start space-x-3">
                  <img
                    src={resolvingFinding.photo_url}
                    alt="Before"
                    className="w-24 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="text-[11px] text-slate-600">
                    <div className="font-semibold text-slate-800 line-clamp-1">{resolvingFinding.description}</div>
                    {resolvingFinding.recommendation && (
                      <div className="text-amber-800 mt-0.5 line-clamp-2 font-medium">
                        คำแนะนำ: {resolvingFinding.recommendation}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* After Photo Upload */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ถ่ายรูป / แนบรูปภาพผลการแก้ไขแล้ว (After Photo) *
                </label>
                {resolveAfterPhoto ? (
                  <div className="relative aspect-video max-h-52 rounded-2xl overflow-hidden bg-black/5 border border-slate-200">
                    <img src={resolveAfterPhoto} alt="After" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setResolveAfterPhoto('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full text-xs shadow-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl aspect-video max-h-48 flex flex-col items-center justify-center cursor-pointer transition bg-white">
                    <Upload className="w-7 h-7 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-600 font-semibold">กดเพื่อถ่ายรูป หรือ อัปโหลดรูปภาพหลังแก้ไข</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">ภาพหลังแก้ไข (ระบบลดขนาดไฟล์อัตโนมัติเพื่อประหยัดพื้นที่)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(e, setResolveAfterPhoto)}
                    />
                  </label>
                )}
              </div>

              {/* Action Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ระบุว่าดำเนินการแก้ไขอย่างไร (Action Details) *
                </label>
                <textarea
                  value={resolveActionTaken}
                  onChange={(e) => setResolveActionTaken(e.target.value)}
                  rows={3}
                  placeholder="เช่น ช่างซ่อมบำรุงเข้าทำการเปลี่ยนสายไฟใหม่และสวมท่อร้อยสายไฟเรียบร้อยแล้ว..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end space-x-2 shrink-0 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingFinding(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-200 transition flex items-center space-x-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmittingResolve ? 'กำลังส่งผล...' : 'ส่งผลการแก้ไขให้แอดมินตรวจ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: Admin Reject / Rework Modal (Requirement 8)           */}
      {/* ============================================================== */}
      {rejectingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-800">ผลการตรวจไม่ผ่าน (ส่งกลับไปแก้ใหม่)</h3>
                  <p className="text-xs text-slate-400">จุดตรวจ: {rejectingFinding.location}</p>
                </div>
              </div>
              <button
                onClick={() => setRejectingFinding(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRejectFinding} className="space-y-4 text-xs">
              {rejectError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{rejectError}</span>
                </div>
              )}

              <p className="text-slate-600 leading-relaxed">
                ระบบจะส่งข้อความแจ้งเตือน (Notification) ไปยัง <strong>{rejectingFinding.resolved_by_name || rejectingFinding.reporter_name}</strong> ทันที เพื่อให้ดำเนินการแก้ไขและส่งรูปภาพใหม่อีกครั้ง
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ระบุเหตุผลที่ไม่ผ่าน และคำแนะนำเพิ่มเติม *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="เช่น รูปภาพไม่ชัดเจน ยังคงมีเศษวัสดุกีดขวางทางเดินอยู่บางส่วน กรุณาเคลียร์พื้นที่ให้เรียบร้อยแล้วถ่ายรูปใหม่อีกครั้ง..."
                  className="w-full px-3 py-2 bg-slate-50 border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRejectingFinding(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md shadow-red-200 transition flex items-center space-x-1.5"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>ยืนยันส่งกลับไปแก้ใหม่</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: Full Image Viewer                                     */}
      {/* ============================================================== */}
      {viewingImage && (
        <div
          onClick={() => setViewingImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-3xl w-full p-4 shadow-2xl overflow-hidden space-y-3"
          >
            <div className="flex items-center justify-between px-2">
              <span className="font-bold text-sm text-slate-800">{viewingImage.title}</span>
              <button
                onClick={() => setViewingImage(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-hidden rounded-2xl bg-black/5 flex items-center justify-center">
              <img
                src={viewingImage.url}
                alt={viewingImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Safety Patrol Export Modal (Admin P3 / P4 only) */}
      {isExportModalOpen && (
        <SafetyPatrolExportModal
          currentUser={currentUser}
          patrols={patrols}
          findings={findings}
          initialPatrolId={exportInitialPatrolId}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </div>
  );
};
