import React, { useState, useEffect, useMemo } from 'react';
import { User, Equipment, InspectionRecord, SafetyPatrolRound, SafetyFinding } from '../types';
import { storageService } from '../services/storage';
import { formatThaiDate } from '../utils/thaiDate';
import { resolveImageProxyUrl, getCandidateUrls } from '../utils/imageFetcher';
import {
  Images,
  Flame,
  Calendar,
  Trash2,
  Eye,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  X,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react';

interface PhotoGalleryPageProps {
  currentUser: User | null;
}

interface DeleteTarget {
  type: 'single_equipment' | 'single_inspection' | 'all_equipment' | 'single_finding' | 'all_patrol';
  title: string;
  description: string;
  equipmentId?: string;
  field?: 'inspection_sheet_photo' | 'location_photo' | 'defect_photo' | 'inspection_photo';
  inspectionId?: string;
  findingId?: string;
  findingField?: 'photo_url' | 'after_photo_url';
  patrolId?: string;
  photoUrl?: string;
}

export const PhotoGalleryPage: React.FC<PhotoGalleryPageProps> = ({ currentUser }) => {
  const isAuthorized = currentUser?.role === 'P3' || currentUser?.role === 'P4';

  const [activeTab, setActiveTab] = useState<'EQUIPMENT' | 'SAFETY_PATROL'>('EQUIPMENT');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(() => storageService.getEquipment());
  const [inspectionsList, setInspectionsList] = useState<InspectionRecord[]>(() => storageService.getInspections());
  const [patrolList, setPatrolList] = useState<SafetyPatrolRound[]>(() => storageService.getSafetyPatrols());
  const [findingsList, setFindingsList] = useState<SafetyFinding[]>(() => storageService.getSafetyFindings());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState<'ALL' | 'EX' | 'FHC' | 'FH' | 'HD' | 'FDC'>('ALL');
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(true);
  const [patrolStatusFilter, setPatrolStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

  // Accordion collapsed state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Lightbox preview modal state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Retention cleanup modal & state
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [isCleaningRetention, setIsCleaningRetention] = useState(false);
  const [retentionResult, setRetentionResult] = useState<{
    success: boolean;
    deleted_inspections?: number;
    deleted_findings?: number;
    deleted_patrols?: number;
    deleted_photos?: number;
    error?: string;
  } | null>(null);

  // Listen for data sync updates
  useEffect(() => {
    const handleSync = () => {
      setEquipmentList(storageService.getEquipment());
      setInspectionsList(storageService.getInspections());
      setPatrolList(storageService.getSafetyPatrols());
      setFindingsList(storageService.getSafetyFindings());
    };
    window.addEventListener('she_data_synced', handleSync);
    return () => window.removeEventListener('she_data_synced', handleSync);
  }, []);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Candidate fallback error handler for <img> elements
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, originalUrl: string) => {
    const img = e.currentTarget;
    const tried = parseInt(img.getAttribute('data-tried') || '0', 10);
    const candidates = getCandidateUrls(originalUrl);
    if (tried < candidates.length) {
      img.setAttribute('data-tried', String(tried + 1));
      img.src = candidates[tried];
    } else {
      img.src = 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=400';
    }
  };

  // -------------------------------------------------------------
  // Data Mapping for Equipment Photos
  // -------------------------------------------------------------
  const equipmentWithPhotos = useMemo(() => {
    return equipmentList.map(item => {
      const photos: Array<{
        id: string;
        type: 'inspection_sheet_photo' | 'location_photo' | 'defect_photo' | 'inspection_photo' | 'inspection_location_photo';
        label: string;
        url: string;
        date?: string;
        inspector?: string;
        inspectionId?: string;
      }> = [];

      if (item.inspection_sheet_photo) {
        photos.push({
          id: `${item.id}_sheet`,
          type: 'inspection_sheet_photo',
          label: 'แผ่นตรวจเช็ค',
          url: resolveImageProxyUrl(item.inspection_sheet_photo),
          date: item.latest_inspection_date || item.updated_at
        });
      }
      if (item.location_photo) {
        photos.push({
          id: `${item.id}_loc`,
          type: 'location_photo',
          label: 'สถานที่ติดตั้ง',
          url: resolveImageProxyUrl(item.location_photo),
          date: item.updated_at
        });
      }
      if (item.defect_photo) {
        photos.push({
          id: `${item.id}_defect`,
          type: 'defect_photo',
          label: 'จุดชำรุด / ปัญหา',
          url: resolveImageProxyUrl(item.defect_photo),
          date: item.updated_at
        });
      }

      // Add historical photos from photo_history if available
      if (item.photo_history && Array.isArray(item.photo_history)) {
        item.photo_history.forEach((h, hIdx) => {
          if (h.photo_url) {
            photos.push({
              id: `${item.id}_hist_${hIdx}`,
              type: 'inspection_sheet_photo',
              label: h.note || `ประวัติ ${h.month_name || ''} ${h.year_be || ''}`,
              url: resolveImageProxyUrl(h.photo_url),
              date: h.date
            });
          }
        });
      }

      // Add inspection history photos for this equipment
      const itemInspections = inspectionsList.filter(i => i.equipment_id === item.id);
      itemInspections.forEach(insp => {
        if (insp.inspection_photo && insp.inspection_photo !== item.inspection_sheet_photo) {
          photos.push({
            id: `${insp.id}_insp`,
            type: 'inspection_photo',
            label: `ตรวจเช็ค ${insp.inspection_date}`,
            url: resolveImageProxyUrl(insp.inspection_photo),
            date: insp.inspection_date,
            inspector: insp.inspector_name,
            inspectionId: insp.id
          });
        }
        if (insp.location_photo && insp.location_photo !== item.location_photo) {
          photos.push({
            id: `${insp.id}_loc`,
            type: 'inspection_location_photo',
            label: `สถานที่ ${insp.inspection_date}`,
            url: resolveImageProxyUrl(insp.location_photo),
            date: insp.inspection_date,
            inspector: insp.inspector_name,
            inspectionId: insp.id
          });
        }
      });

      return {
        equipment: item,
        photos,
        hasPhotos: photos.length > 0
      };
    });
  }, [equipmentList, inspectionsList]);

  // Filtered equipment list
  const filteredEquipment = useMemo(() => {
    return equipmentWithPhotos.filter(({ equipment, hasPhotos }) => {
      if (onlyWithPhotos && !hasPhotos) return false;
      if (equipmentTypeFilter !== 'ALL' && equipment.type !== equipmentTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = equipment.code.toLowerCase().includes(q);
        const locMatch = (equipment.location || '').toLowerCase().includes(q);
        const personMatch = (equipment.responsible_person || '').toLowerCase().includes(q);
        if (!codeMatch && !locMatch && !personMatch) return false;
      }
      return true;
    });
  }, [equipmentWithPhotos, onlyWithPhotos, equipmentTypeFilter, searchQuery]);

  // Total equipment photos count
  const totalEquipmentPhotosCount = useMemo(() => {
    return equipmentWithPhotos.reduce((acc, item) => acc + item.photos.length, 0);
  }, [equipmentWithPhotos]);

  // -------------------------------------------------------------
  // Data Mapping for Safety Patrol (คปอ.) Photos
  // -------------------------------------------------------------
  const patrolsWithFindings = useMemo(() => {
    return patrolList.map(patrol => {
      const findings = findingsList.filter(f => f.patrol_id === patrol.id);
      let totalPhotos = 0;
      findings.forEach(f => {
        if (f.photo_url) totalPhotos++;
        if (f.after_photo_url) totalPhotos++;
      });
      return {
        patrol,
        findings,
        totalPhotos,
        hasPhotos: totalPhotos > 0
      };
    });
  }, [patrolList, findingsList]);

  const filteredPatrols = useMemo(() => {
    return patrolsWithFindings.filter(({ patrol, hasPhotos }) => {
      if (onlyWithPhotos && !hasPhotos) return false;
      if (patrolStatusFilter !== 'ALL' && patrol.status !== patrolStatusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (patrol.title || '').toLowerCase().includes(q);
        const locMatch = (patrol.location || '').toLowerCase().includes(q);
        const dateMatch = (patrol.patrol_date || '').toLowerCase().includes(q);
        if (!titleMatch && !locMatch && !dateMatch) return false;
      }
      return true;
    });
  }, [patrolsWithFindings, onlyWithPhotos, patrolStatusFilter, searchQuery]);

  const totalPatrolPhotosCount = useMemo(() => {
    return patrolsWithFindings.reduce((acc, p) => acc + p.totalPhotos, 0);
  }, [patrolsWithFindings]);

  // -------------------------------------------------------------
  // Deletion Handlers
  // -------------------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === 'single_equipment' && deleteTarget.equipmentId && deleteTarget.field) {
        await storageService.deleteEquipmentPhoto(
          deleteTarget.equipmentId,
          deleteTarget.field as 'inspection_sheet_photo' | 'location_photo' | 'defect_photo'
        );
      } else if (deleteTarget.type === 'single_inspection' && deleteTarget.inspectionId && deleteTarget.field) {
        await storageService.deleteInspectionPhoto(
          deleteTarget.inspectionId,
          deleteTarget.field as 'inspection_photo' | 'location_photo'
        );
      } else if (deleteTarget.type === 'all_equipment' && deleteTarget.equipmentId) {
        await storageService.deleteAllEquipmentPhotos(deleteTarget.equipmentId);
      } else if (deleteTarget.type === 'single_finding' && deleteTarget.findingId && deleteTarget.findingField) {
        await storageService.deleteSafetyFindingPhoto(deleteTarget.findingId, deleteTarget.findingField);
      } else if (deleteTarget.type === 'all_patrol' && deleteTarget.patrolId) {
        await storageService.deleteAllPatrolPhotos(deleteTarget.patrolId);
      }
      setDeleteTarget(null);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบรูปภาพ: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------
  // Retention Purge Handler (2-Year Limit)
  // -------------------------------------------------------------
  const handleRunRetentionCleanup = async () => {
    setIsCleaningRetention(true);
    setRetentionResult(null);
    try {
      const res = await storageService.runRetentionCleanup();
      setRetentionResult(res);
    } catch (err: any) {
      setRetentionResult({ success: false, error: err.message });
    } finally {
      setIsCleaningRetention(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">สิทธิ์การเข้าถึงถูกจำกัด</h2>
        <p className="text-slate-600 text-sm">
          หน้านี้สามารถเข้าถึงได้เฉพาะผู้ดูแลระบบระดับ <b>P3 (แอดมิน)</b> และ <b>P4 (ผู้จัดการระบบ)</b> เท่านั้น
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8DFC8] pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#A04830] text-white rounded-2xl shadow-md">
              <Images className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2">
                คลังรูปภาพส่วนกลาง (Photo Gallery)
                <span className="bg-[#A04830]/10 text-[#A04830] text-xs font-bold px-2 py-0.5 rounded-full border border-[#A04830]/20">
                  สิทธิ์ P3 / P4
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                ศูนย์กลางจัดการและตรวจสอบไฟล์รูปภาพทั้งหมดในระบบ เชื่อมต่อ Microsoft Azure Blob Storage
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Policy Banner */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-start space-x-3">
          <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <b className="text-amber-950 font-bold block">นโยบายการจัดเก็บข้อมูล (Data Retention): ไม่เกิน 2 ปี (24 เดือน)</b>
            <span className="text-amber-800/90 text-xs">
              ระบบทำงานอัตโนมัติ (Scheduler) ทุกวันที่ 1 ของเดือน เวลา 02:00 น. เพื่อลบประวัติการตรวจเช็คและไฟล์รูปภาพใน Azure Blob Storage ที่มีอายุเกิน 2 ปี
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            setRetentionResult(null);
            setIsRetentionModalOpen(true);
          }}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-xs shrink-0 self-end sm:self-center"
        >
          ตรวจสอบ/ล้างข้อมูลเก่าทันที
        </button>
      </div>

      {/* Main Tabs (1. อุปกรณ์, 2. รายการ คปอ.) */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('EQUIPMENT')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-sm transition ${
            activeTab === 'EQUIPMENT'
              ? 'border-[#A04830] text-[#A04830]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>1. รูปภาพอุปกรณ์ (Equipment)</span>
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full ml-1 font-semibold">
            {totalEquipmentPhotosCount} รูป
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SAFETY_PATROL')}
          className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-bold text-sm transition ${
            activeTab === 'SAFETY_PATROL'
              ? 'border-[#A04830] text-[#A04830]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>2. รูปภาพรายการ คปอ. (Safety Committee)</span>
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full ml-1 font-semibold">
            {totalPatrolPhotosCount} รูป
          </span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'EQUIPMENT'
                ? 'ค้นหาตามรหัสอุปกรณ์ (เช่น EX-001), จุดติดตั้ง, ผู้รับผิดชอบ...'
                : 'ค้นหาตามหัวข้อรอบเดินตรวจ, สถานที่, วันที่...'
            }
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#A04830]/30 focus:border-[#A04830]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'EQUIPMENT' && (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
              {(['ALL', 'EX', 'FHC', 'FH', 'HD', 'FDC'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setEquipmentTypeFilter(type)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    equipmentTypeFilter === type
                      ? 'bg-white text-[#A04830] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'ทั้งหมด' : type}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'SAFETY_PATROL' && (
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
              {(['ALL', 'OPEN', 'CLOSED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setPatrolStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    patrolStatusFilter === st
                      ? 'bg-white text-[#A04830] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st === 'ALL' ? 'ทั้งหมด' : st === 'OPEN' ? 'เปิดตรวจ' : 'ปิดตรวจแล้ว'}
                </button>
              ))}
            </div>
          )}

          <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100">
            <input
              type="checkbox"
              checked={onlyWithPhotos}
              onChange={(e) => setOnlyWithPhotos(e.target.checked)}
              className="rounded text-[#A04830] focus:ring-[#A04830]"
            />
            <span>เฉพาะที่มีรูปภาพ</span>
          </label>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: EQUIPMENT PHOTOS TAB */}
      {/* ========================================================= */}
      {activeTab === 'EQUIPMENT' && (
        <div className="space-y-4">
          {filteredEquipment.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-base text-slate-700">ไม่พบรูปภาพอุปกรณ์ตามเงื่อนไขที่ค้นหา</p>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือยกเลิกการเลือก "เฉพาะที่มีรูปภาพ"</p>
            </div>
          ) : (
            filteredEquipment.map(({ equipment, photos }) => {
              const isCollapsed = collapsedGroups[equipment.id] || false;
              return (
                <div
                  key={equipment.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                >
                  {/* Equipment Header Bar */}
                  <div className="bg-[#FAF7F2] border-b border-[#E8DFC8] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div
                      className="flex items-center space-x-3 cursor-pointer select-none flex-1"
                      onClick={() => toggleGroupCollapse(equipment.id)}
                    >
                      <button className="text-slate-400 hover:text-slate-600 transition">
                        {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                      </button>
                      <div className="flex items-center space-x-2">
                        <span className="bg-[#A04830] text-white text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg shadow-xs tracking-wider">
                          {equipment.code}
                        </span>
                        <span className="text-xs font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                          {equipment.type}
                        </span>
                      </div>
                      <div className="truncate text-xs sm:text-sm text-slate-700 font-medium">
                        📍 {equipment.location}
                      </div>
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full ml-auto sm:ml-0 shrink-0">
                        {photos.length} รูป
                      </span>
                    </div>

                    {/* Action: Delete all photos of this equipment */}
                    {photos.length > 0 && (
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'all_equipment',
                            equipmentId: equipment.id,
                            title: `ลบรูปภาพทั้งหมดของ ${equipment.code}`,
                            description: `การกระทำนี้จะลบไฟล์รูปภาพทั้งหมดจำนวน ${photos.length} รูปของอุปกรณ์ "${equipment.code}" ออกจาก Microsoft Azure Blob Storage และ Database ถาวร`
                          })
                        }
                        className="inline-flex items-center space-x-1.5 text-xs text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 px-3 py-1.5 rounded-xl font-bold transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบรูปทั้งหมดของ {equipment.code}</span>
                      </button>
                    )}
                  </div>

                  {/* Photos Grid */}
                  {!isCollapsed && (
                    <div className="p-4">
                      {photos.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">ไม่มีรูปภาพสำหรับอุปกรณ์นี้</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                          {photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="group relative bg-slate-50 border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition flex flex-col"
                            >
                              {/* Photo thumbnail */}
                              <div
                                className="relative aspect-4/3 bg-slate-200 cursor-pointer overflow-hidden"
                                onClick={() =>
                                  setPreviewImage({
                                    url: photo.url,
                                    title: `${equipment.code} - ${photo.label}`,
                                    subtitle: photo.inspector ? `ผู้ตรวจ: ${photo.inspector} (${photo.date})` : photo.date
                                  })
                                }
                              >
                                <img
                                  src={photo.url}
                                  alt={photo.label}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  loading="lazy"
                                  onError={(e) => handleImageError(e, photo.url)}
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2 text-white">
                                  <span className="p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition">
                                    <Eye className="w-4 h-4" />
                                  </span>
                                </div>
                              </div>

                              {/* Photo Details & Delete action */}
                              <div className="p-2.5 flex items-center justify-between gap-1 mt-auto bg-white border-t border-slate-100">
                                <div className="truncate flex-1">
                                  <span className="text-[11px] font-bold text-slate-800 block truncate" title={photo.label}>
                                    {photo.label}
                                  </span>
                                  {photo.date && (
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {formatThaiDate(photo.date)}
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: photo.inspectionId ? 'single_inspection' : 'single_equipment',
                                      equipmentId: equipment.id,
                                      inspectionId: photo.inspectionId,
                                      field: photo.type.startsWith('inspection')
                                        ? (photo.type === 'inspection_location_photo' ? 'location_photo' : 'inspection_photo')
                                        : (photo.type as any),
                                      photoUrl: photo.url,
                                      title: `ลบรูปภาพ "${photo.label}"`,
                                      description: `คุณต้องการลบรูปภาพนี้ของ "${equipment.code}" ออกจาก Azure Blob Storage และ Database หรือไม่?`
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                                  title="ลบรูปนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: SAFETY COMMITTEE (คปอ.) PHOTOS TAB */}
      {/* ========================================================= */}
      {activeTab === 'SAFETY_PATROL' && (
        <div className="space-y-4">
          {filteredPatrols.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-base text-slate-700">ไม่พบรูปภาพรายการ คปอ. ตามเงื่อนไขที่ค้นหา</p>
              <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือสร้างรอบการเดินตรวจ คปอ. พร้อมบันทึกภาพถ่าย</p>
            </div>
          ) : (
            filteredPatrols.map(({ patrol, findings, totalPhotos }) => {
              const isCollapsed = collapsedGroups[patrol.id] || false;
              return (
                <div
                  key={patrol.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition"
                >
                  {/* Patrol Header Bar */}
                  <div className="bg-[#FAF7F2] border-b border-[#E8DFC8] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div
                      className="flex items-center space-x-3 cursor-pointer select-none flex-1"
                      onClick={() => toggleGroupCollapse(patrol.id)}
                    >
                      <button className="text-slate-400 hover:text-slate-600 transition">
                        {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                      </button>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs sm:text-sm font-black text-slate-900">{patrol.title}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              patrol.status === 'OPEN'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {patrol.status === 'OPEN' ? 'กำลังเปิดตรวจ' : 'ปิดรอบแล้ว'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                          <span>📅 {formatThaiDate(patrol.patrol_date)}</span>
                          <span>⏰ {patrol.time_range}</span>
                          {patrol.location && <span>📍 {patrol.location}</span>}
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-full ml-auto sm:ml-2 shrink-0">
                        {totalPhotos} รูปภาพ
                      </span>
                    </div>

                    {/* Action: Delete all photos in this patrol round */}
                    {totalPhotos > 0 && (
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'all_patrol',
                            patrolId: patrol.id,
                            title: `ลบรูปภาพทั้งหมดในรอบ "${patrol.title}"`,
                            description: `การกระทำนี้จะลบไฟล์รูปภาพ Before & After ทั้งหมดจำนวน ${totalPhotos} รูปในรอบการตรวจนี้ออกจาก Azure Blob Storage และ Database ถาวร`
                          })
                        }
                        className="inline-flex items-center space-x-1.5 text-xs text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 px-3 py-1.5 rounded-xl font-bold transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบรูปทั้งหมดในรอบนี้</span>
                      </button>
                    )}
                  </div>

                  {/* Findings in this patrol */}
                  {!isCollapsed && (
                    <div className="p-4 space-y-4">
                      {findings.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">
                          ไม่มีรายการบันทึกผลการเดินตรวจในรอบนี้
                        </p>
                      ) : (
                        findings.map((finding) => {
                          const hasBefore = Boolean(finding.photo_url);
                          const hasAfter = Boolean(finding.after_photo_url);

                          return (
                            <div
                              key={finding.id}
                              className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3"
                            >
                              {/* Finding Info Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      finding.category === 'RECOMMEND'
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    }`}
                                  >
                                    {finding.category === 'RECOMMEND' ? 'ข้อเสนอแนะ' : 'ข้อชมเชย'}
                                  </span>
                                  <b className="text-xs sm:text-sm text-slate-800">📍 {finding.location}</b>
                                  {finding.sub_type && (
                                    <span className="text-[10px] text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-md">
                                      {finding.sub_type}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  ผู้รายงาน: {finding.reporter_name}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 font-medium">
                                <b>สิ่งที่พบ:</b> {finding.description}
                              </p>

                              {/* Photo Cards (Before & After) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {/* Before Photo */}
                                <div className="border border-slate-200 bg-white rounded-xl p-2.5 flex items-center space-x-3">
                                  {hasBefore ? (
                                    <>
                                      <div
                                        className="relative w-20 h-20 bg-slate-200 rounded-lg overflow-hidden shrink-0 cursor-pointer group"
                                        onClick={() =>
                                          setPreviewImage({
                                            url: finding.photo_url,
                                            title: `ก่อนแก้ไข: ${finding.location}`,
                                            subtitle: finding.description
                                          })
                                        }
                                      >
                                        <img
                                          src={finding.photo_url}
                                          alt="Before"
                                          className="w-full h-full object-cover group-hover:scale-105 transition"
                                          loading="lazy"
                                          onError={(e) => handleImageError(e, finding.photo_url)}
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                          <Eye className="w-4 h-4" />
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-slate-800 block">
                                          รูปก่อนแก้ไข (Before)
                                        </span>
                                        <span className="text-[10px] text-slate-500 block truncate">
                                          แนบโดย {finding.reporter_name}
                                        </span>
                                        <button
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: 'single_finding',
                                              findingId: finding.id,
                                              findingField: 'photo_url',
                                              photoUrl: finding.photo_url,
                                              title: 'ลบรูปก่อนแก้ไข (Before)',
                                              description: `ต้องการลบรูปภาพก่อนแก้ไขของ "${finding.location}" ออกจาก Azure Blob Storage หรือไม่?`
                                            })
                                          }
                                          className="mt-2 inline-flex items-center space-x-1 text-[11px] text-red-600 hover:text-red-700 font-bold"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>ลบรูปนี้</span>
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="py-4 text-center w-full text-xs text-slate-400 italic">
                                      ไม่มีรูปภาพก่อนแก้ไข
                                    </div>
                                  )}
                                </div>

                                {/* After Photo */}
                                <div className="border border-slate-200 bg-white rounded-xl p-2.5 flex items-center space-x-3">
                                  {hasAfter ? (
                                    <>
                                      <div
                                        className="relative w-20 h-20 bg-slate-200 rounded-lg overflow-hidden shrink-0 cursor-pointer group"
                                        onClick={() =>
                                          setPreviewImage({
                                            url: finding.after_photo_url!,
                                            title: `หลังแก้ไข (After): ${finding.location}`,
                                            subtitle: finding.action_taken || 'ดำเนินการแก้ไขแล้ว'
                                          })
                                        }
                                      >
                                        <img
                                          src={finding.after_photo_url}
                                          alt="After"
                                          className="w-full h-full object-cover group-hover:scale-105 transition"
                                          loading="lazy"
                                          onError={(e) => handleImageError(e, finding.after_photo_url!)}
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                          <Eye className="w-4 h-4" />
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-emerald-700 block">
                                          รูปหลังแก้ไข (After)
                                        </span>
                                        <span className="text-[10px] text-slate-500 block truncate">
                                          แก้ไขโดย {finding.resolved_by_name || '-'}
                                        </span>
                                        <button
                                          onClick={() =>
                                            setDeleteTarget({
                                              type: 'single_finding',
                                              findingId: finding.id,
                                              findingField: 'after_photo_url',
                                              photoUrl: finding.after_photo_url,
                                              title: 'ลบรูปหลังแก้ไข (After)',
                                              description: `ต้องการลบรูปภาพหลังแก้ไขของ "${finding.location}" ออกจาก Azure Blob Storage หรือไม่?`
                                            })
                                          }
                                          className="mt-2 inline-flex items-center space-x-1 text-[11px] text-red-600 hover:text-red-700 font-bold"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>ลบรูปนี้</span>
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="py-4 text-center w-full text-xs text-slate-400 italic">
                                      ยังไม่มีรูปภาพผลการแก้ไข (รอผู้รับผิดชอบส่งผล)
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* LIGHTBOX PREVIEW MODAL */}
      {/* ========================================================= */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm sm:text-base">{previewImage.title}</h3>
                {previewImage.subtitle && (
                  <p className="text-xs text-slate-400">{previewImage.subtitle}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewImage.url}
                  download="image.jpg"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="ดาวน์โหลดรูป"
                >
                  <Download className="w-5 h-5" />
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Display */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
                onError={(e) => handleImageError(e, previewImage.url)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONFIRM DELETE MODAL */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{deleteTarget.title}</h3>
                <p className="text-xs text-slate-500">ยืนยันการลบไฟล์จากระบบ</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              {deleteTarget.description}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังลบไฟล์...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ยืนยันลบออกจากระบบ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RETENTION POLICY & 2-YEAR PURGE MODAL */}
      {/* ========================================================= */}
      {isRetentionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-amber-800">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base">นโยบายจัดเก็บข้อมูล 2 ปี (Retention Policy)</h3>
              </div>
              <button
                onClick={() => setIsRetentionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 space-y-3">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-950">
                <b className="font-bold block mb-1">⏱️ ข้อกำหนดการจัดเก็บข้อมูล:</b>
                <p className="leading-relaxed">
                  ระบบกำหนดให้บันทึกประวัติและรูปภาพไว้สูงสุด <b>2 ปี (24 เดือน)</b> เพื่อประหยัดพื้นที่จัดเก็บใน Microsoft Azure Blob Storage และรักษาประสิทธิภาพของฐานข้อมูล Azure SQL
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <p>• <b>Scheduler อัตโนมัติ:</b> รันทุกวันที่ 1 ของเดือน เวลา 02:00 น. (เวลาประเทศไทย UTC+7)</p>
                <p>• <b>ข้อมูลที่จะถูกลบ:</b> ประวัติการตรวจเช็คที่เก่าเกิน 2 ปี, รายการเดินตรวจ คปอ. ที่เก่าเกิน 2 ปี และไฟล์รูปภาพทั้งหมดที่เกี่ยวข้อง</p>
                <p>• <b>รายการอุปกรณ์ปัจจุบัน:</b> จะไม่ถูกลบ รหัสถังและข้อมูลหลักยังคงอยู่ตามปกติ</p>
              </div>

              {retentionResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    retentionResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {retentionResult.success ? (
                    <div className="space-y-1">
                      <b className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4" /> ตรวจสอบและล้างข้อมูลเรียบร้อยแล้ว
                      </b>
                      <p>• ลบประวัติการตรวจเช็คเก่า: {retentionResult.deleted_inspections ?? 0} รายการ</p>
                      <p>• ลบรายการ คปอ. เก่า: {retentionResult.deleted_findings ?? 0} รายการ</p>
                      <p>• ลบรอบเดินตรวจ คปอ. เก่า: {retentionResult.deleted_patrols ?? 0} รอบ</p>
                      <p>• ลบไฟล์รูปภาพใน Azure Blob Storage: {retentionResult.deleted_photos ?? 0} ไฟล์</p>
                    </div>
                  ) : (
                    <div>
                      <b className="font-bold block">เกิดข้อผิดพลาด:</b>
                      <span>{retentionResult.error || 'ไม่สามารถล้างข้อมูลได้'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRetentionModalOpen(false)}
                disabled={isCleaningRetention}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={handleRunRetentionCleanup}
                disabled={isCleaningRetention}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
              >
                {isCleaningRetention ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>กำลังประมวลผล...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>เริ่มล้างข้อมูลเก่ากว่า 2 ปี เดี๋ยวนี้</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
