import React, { useState, useEffect } from 'react';
import { Equipment, InspectionRecord } from '../types';
import { formatThaiDate } from '../utils/thaiDate';
import { getEquipmentPhotoArchives } from '../utils/photoArchive';
import { storageService } from '../services/storage';
import { resolveImageProxyUrl, handleImgErrorWithCandidates } from '../utils/imageFetcher';
import {
  X,
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  MapPin,
  Calendar,
  Layers,
  Scale,
  UserCheck,
  History,
  Edit,
  Trash2,
  CheckSquare,
  ZoomIn,
  Images,
  FolderArchive,
  ChevronRight,
  RotateCcw,
  Save,
  Check,
  PowerOff
} from 'lucide-react';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  inspectionHistory: InspectionRecord[];
  canInspect: boolean;
  isAdminOrSuper: boolean;
  onClose: () => void;
  onStartInspection: (equip: Equipment) => void;
  onEditEquipment?: (equip: Equipment) => void;
  onDeleteEquipment?: (id: string, code: string) => void;
  onViewImage: (url: string, title?: string) => void;
}

export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({
  equipment,
  inspectionHistory,
  canInspect,
  isAdminOrSuper,
  onClose,
  onStartInspection,
  onEditEquipment,
  onDeleteEquipment,
  onViewImage
}) => {
  if (!equipment) return null;

  const photoArchives = getEquipmentPhotoArchives(equipment, inspectionHistory);
  const totalArchivedPhotos = photoArchives.reduce((acc, y) => acc + y.totalPhotos, 0);
  const [selectedArchiveYear, setSelectedArchiveYear] = useState<number | null>(null);

  const activeArchiveYear = selectedArchiveYear || photoArchives[0]?.yearBE || null;
  const currentYearGroup = photoArchives.find(y => y.yearBE === activeArchiveYear) || photoArchives[0];

  const [localHistory, setLocalHistory] = useState<InspectionRecord[]>(inspectionHistory);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>('');
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [currentUsageStatus, setCurrentUsageStatus] = useState<string>(equipment?.usage_status || 'ACTIVE');

  useEffect(() => {
    setLocalHistory(inspectionHistory);
  }, [inspectionHistory]);

  useEffect(() => {
    setCurrentUsageStatus(equipment?.usage_status || 'ACTIVE');
  }, [equipment]);

  const handleToggleUsage = () => {
    if (!equipment) return;
    const nextStatus = currentUsageStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    const msg = nextStatus === 'INACTIVE'
      ? `ต้องการเปลี่ยนสถานะของ "${equipment.code}" เป็น "ยกเลิกการใช้งาน" ใช่หรือไม่?\n\n*อุปกรณ์นี้จะไม่ถูกนำไปนับในยอดความพร้อมใช้งาน (Ready) บน Dashboard`
      : `ต้องการเปลี่ยนสถานะของ "${equipment.code}" กลับเป็น "ใช้งานอยู่" ใช่หรือไม่?\n\n*อุปกรณ์นี้จะถูกนำกลับไปคิดคำนวณในแดชบอร์ดตามปกติ`;
    if (!confirm(msg)) return;

    storageService.updateEquipment(equipment.id, { usage_status: nextStatus });
    setCurrentUsageStatus(nextStatus);
    setActionMessage(nextStatus === 'INACTIVE' ? 'เปลี่ยนเป็น "ยกเลิกการใช้งาน" เรียบร้อย' : 'เปลี่ยนเป็น "ใช้งานอยู่" เรียบร้อย');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const toDateTimeLocal = (isoStr: string) => {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleStartEditTime = (record: InspectionRecord) => {
    setEditingRecordId(record.id);
    setEditingDateValue(toDateTimeLocal(record.inspection_date));
  };

  const handleSaveEditTime = (recordId: string) => {
    if (!editingDateValue) return;
    const newDateIso = new Date(editingDateValue).toISOString();
    storageService.updateInspectionTime(recordId, newDateIso);
    setLocalHistory(prev => prev.map(r => r.id === recordId ? { ...r, inspection_date: newDateIso } : r));
    setEditingRecordId(null);
    setActionMessage('แก้ไขเวลาตรวจเช็คเรียบร้อยแล้ว');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const hasInspectionThisMonth = localHistory.some(r => {
    const d = new Date(r.inspection_date);
    return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const handleClearThisEquipmentMonth = async () => {
    setIsClearing(true);
    try {
      await storageService.clearMonthInspections({ equipment_id: equipment.id });
      setLocalHistory(prev => prev.filter(r => {
        const d = new Date(r.inspection_date);
        return isNaN(d.getTime()) || !(d.getMonth() === currentMonth && d.getFullYear() === currentYear);
      }));
      setShowClearConfirm(false);
      setActionMessage('ล้างประวัติการตรวจเช็ครอบเดือนนี้ของอุปกรณ์นี้เรียบร้อยแล้ว');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการล้างประวัติ: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const getTypeTitle = () => {
    switch (equipment.type) {
      case 'EX': return 'ถังดับเพลิง (EX)';
      case 'FHC': return 'ตู้ดับเพลิง (FHC)';
      case 'FH': return 'ตู้สายฉีด (FH)';
      case 'HD': return 'หัวจ่ายน้ำ (HD)';
      case 'FDC': return 'หัวรับน้ำ (FDC)';
      default: return equipment.type;
    }
  };

  const getCategoryLabel = () => {
    switch (equipment.type) {
      case 'EX': return 'ชนิดของถังดับเพลิง';
      case 'FHC': return 'ประเภทตู้ดับเพลิง';
      case 'FH': return 'ประเภทตู้สายฉีด';
      case 'HD': return 'ชนิดหัวจ่ายน้ำดับเพลิง';
      case 'FDC': return 'ชนิดหัวรับน้ำดับเพลิง';
      default: return 'ชนิด / ประเภท';
    }
  };

  const getWeightLabel = () => {
    switch (equipment.type) {
      case 'EX': return 'น้ำหนักของถัง';
      case 'FHC': return 'ขนาดตู้และสายฉีด';
      case 'FH': return 'ขนาดและระยะสายฉีด';
      case 'HD': return 'ขนาดข้อต่อทางน้ำออก';
      case 'FDC': return 'ขนาดข้อต่อทางน้ำเข้า';
      default: return 'น้ำหนัก / ขนาด';
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-slate-800">{equipment.code}</h3>
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                  {getTypeTitle()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                รายละเอียดอุปกรณ์และประวัติการตรวจเช็ค
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          {/* Status Bar */}
          <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">สถานะการตรวจ:</span>
              {equipment.inspection_status === 'INSPECTED' ? (
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>ตรวจรอบนี้แล้ว</span>
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>ยังไม่ตรวจ</span>
                </span>
              )}
            </div>

            {/* Usage Status (ใช้งานอยู่ / ยกเลิกการใช้งาน) */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">การใช้งาน:</span>
              {currentUsageStatus === 'INACTIVE' ? (
                <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border border-slate-300">
                  <PowerOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>ยกเลิกการใช้งาน</span>
                </span>
              ) : (
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ใช้งานอยู่</span>
                </span>
              )}
              {isAdminOrSuper && (
                <button
                  type="button"
                  onClick={handleToggleUsage}
                  className="ml-1 text-[10px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
                  title="คลิกเพื่อสลับสถานะ ใช้งานอยู่ / ยกเลิกการใช้งาน"
                >
                  {currentUsageStatus === 'INACTIVE' ? '[เปิดใช้งาน]' : '[ยกเลิกใช้งาน]'}
                </button>
              )}
            </div>

            <div className="flex items-center space-x-1.5 ml-auto">
              <span className="text-slate-400">ความพร้อมใช้งาน:</span>
              {equipment.defect_status === 'DEFECT' ? (
                <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>พบข้อบกพร่อง</span>
                </span>
              ) : equipment.defect_status === 'RESOLVED' ? (
                <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold flex items-center space-x-1">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>แก้ไขเรียบร้อย</span>
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
                  สภาพปกติ (READY)
                </span>
              )}
            </div>
          </div>

          {/* Key Specifications Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                <span>สถานที่ติดตั้ง</span>
              </div>
              <div className="font-semibold text-slate-800 text-sm">{equipment.location}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>ผู้รับผิดชอบอุปกรณ์</span>
              </div>
              <div className="font-semibold text-slate-800 text-sm">{equipment.responsible_person}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>{getCategoryLabel()}</span>
              </div>
              <div className="font-semibold text-slate-800">{equipment.category || '-'}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <Scale className="w-3.5 h-3.5 text-amber-500" />
                <span>{getWeightLabel()}</span>
              </div>
              <div className="font-semibold text-slate-800">{equipment.weight || '-'}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>วันที่เริ่มใช้งาน</span>
              </div>
              <div className="font-semibold text-slate-800">{equipment.in_service_date || '-'}</div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center space-x-1 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-red-500" />
                <span>อายุอุปกรณ์ (คำนวณ)</span>
              </div>
              <div className="font-semibold text-red-600">{equipment.age?.formatted || '-'}</div>
            </div>
          </div>

          {/* Defect note if present */}
          {equipment.defect_notes && (
            <div className={`p-3.5 rounded-2xl border ${
              equipment.defect_status === 'DEFECT'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="font-bold flex items-center space-x-1.5 mb-1 text-xs">
                {equipment.defect_status === 'DEFECT' ? (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                ) : (
                  <Wrench className="w-4 h-4 text-blue-600" />
                )}
                <span>{equipment.defect_status === 'DEFECT' ? 'ข้อบกพร่องที่ต้องแก้ไข:' : 'บันทึกการแก้ไข:'}</span>
              </div>
              <p className="text-xs leading-relaxed">{equipment.defect_notes}</p>
            </div>
          )}

          {/* Photos Section: Current Photos & Photo Archive by Year/Month */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center space-x-1.5 text-sm">
                <Images className="w-4 h-4 text-blue-600" />
                <span>รูปภาพอุปกรณ์ปัจจุบัน (คลิกเพื่อดูขนาดใหญ่)</span>
              </h4>
              {totalArchivedPhotos > 1 && (
                <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
                  มีประวัติภาพ {totalArchivedPhotos} รูป
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Current Tank Photo */}
              {equipment.inspection_sheet_photo ? (
                <div
                  onClick={() => onViewImage(resolveImageProxyUrl(equipment.inspection_sheet_photo!), `รูปถัง/อุปกรณ์ปัจจุบัน - ${equipment.code}`)}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-video cursor-pointer bg-slate-900 shadow-xs"
                >
                  <img
                    src={resolveImageProxyUrl(equipment.inspection_sheet_photo)}
                    alt="รูปถังปัจจุบัน"
                    onError={(e) => handleImgErrorWithCandidates(e, equipment.inspection_sheet_photo)}
                    className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-90 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white space-x-1 font-medium text-xs">
                    <ZoomIn className="w-4 h-4" />
                    <span>กดดูรูปขนาดใหญ่</span>
                  </div>
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-lg font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>รูปถัง/อุปกรณ์ปัจจุบัน (ล่าสุด)</span>
                  </span>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 aspect-video flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-4 text-center">
                  <span className="text-[11px]">ไม่มีรูปถัง/อุปกรณ์</span>
                </div>
              )}

              {/* Location Photo */}
              {equipment.location_photo ? (
                <div
                  onClick={() => onViewImage(resolveImageProxyUrl(equipment.location_photo!), `รูปสถานที่ติดตั้ง - ${equipment.code}`)}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-video cursor-pointer bg-slate-900 shadow-xs"
                >
                  <img
                    src={resolveImageProxyUrl(equipment.location_photo)}
                    alt="สถานที่ติดตั้ง"
                    onError={(e) => handleImgErrorWithCandidates(e, equipment.location_photo)}
                    className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-90 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white space-x-1 font-medium text-xs">
                    <ZoomIn className="w-4 h-4" />
                    <span>กดดูรูปขนาดใหญ่</span>
                  </div>
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-lg font-medium">
                    รูปสถานที่ติดตั้ง
                  </span>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 aspect-video flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-4 text-center">
                  <span className="text-[11px]">ไม่มีรูปสถานที่ติดตั้ง</span>
                </div>
              )}
            </div>

            {/* Photo Archive Grouped by Year and Month (จัดเก็บตามปีเดือน) */}
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FolderArchive className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-slate-800">
                    คลังประวัติรูปภาพถัง/อุปกรณ์ (จัดเก็บตามปีและเดือน)
                  </span>
                </div>

                {photoArchives.length > 1 && (
                  <div className="flex items-center space-x-1">
                    {photoArchives.map(yGroup => (
                      <button
                        key={yGroup.yearBE}
                        onClick={() => setSelectedArchiveYear(yGroup.yearBE)}
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition ${
                          activeArchiveYear === yGroup.yearBE
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ปี พ.ศ. {yGroup.yearBE}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {photoArchives.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  ยังไม่มีประวัติรูปภาพก่อนหน้านี้
                </div>
              ) : (
                <div className="space-y-3">
                  {currentYearGroup?.months.map(mGroup => (
                    <div
                      key={`${currentYearGroup.yearBE}_${mGroup.monthIdx}`}
                      className="bg-white rounded-xl p-3 border border-slate-200/70 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                        <span className="font-extrabold text-slate-800 flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-purple-500" />
                          <span>ประจำเดือน {mGroup.monthName} {currentYearGroup.yearBE}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {mGroup.photos.length} รูป
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {mGroup.photos.map(photo => (
                          <div
                            key={photo.id}
                            onClick={() => onViewImage(resolveImageProxyUrl(photo.url), `[${equipment.code}] ${photo.label} (${mGroup.monthName} ${currentYearGroup.yearBE})`)}
                            className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video cursor-pointer bg-slate-900 shadow-2xs hover:border-purple-300 transition"
                          >
                            <img
                              src={resolveImageProxyUrl(photo.url)}
                              alt={photo.label}
                              onError={(e) => handleImgErrorWithCandidates(e, photo.url)}
                              className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-90 transition duration-200"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                              <ZoomIn className="w-4 h-4" />
                            </div>

                            {/* Badges on thumbnail */}
                            <div className="absolute bottom-1 left-1 right-1 flex flex-col space-y-0.5">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold text-white truncate text-center ${
                                photo.isCurrent ? 'bg-emerald-600/90' : 'bg-black/70'
                              }`}>
                                {photo.isCurrent ? '✓ รูปปัจจุบัน' : photo.label}
                              </span>
                              {photo.inspector && (
                                <span className="text-[8px] text-slate-200 bg-black/60 px-1 py-0.2 rounded text-center truncate">
                                  {photo.inspector}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Inspection History */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>ประวัติการตรวจเช็คย้อนหลัง ({localHistory.length} ครั้ง)</span>
              </h4>

              {isAdminOrSuper && hasInspectionThisMonth && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-200 flex items-center space-x-1 transition cursor-pointer"
                  title="ล้างผลการตรวจเช็ครอบเดือนนี้ของอุปกรณ์นี้ (สิทธิ์ P3/P4)"
                >
                  <RotateCcw className="w-3 h-3 text-rose-600" />
                  <span>ล้างประวัติเดือนนี้</span>
                </button>
              )}
            </div>

            {actionMessage && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{actionMessage}</span>
              </div>
            )}

            {localHistory.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl text-xs">
                ยังไม่มีประวัติการตรวจเช็คสำหรับอุปกรณ์นี้
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {localHistory.map(record => (
                  <div
                    key={record.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition space-y-1.5"
                  >
                    {editingRecordId === record.id ? (
                      <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2">
                        <label className="block text-[11px] font-bold text-blue-900">
                          แก้ไขวันและเวลาตรวจเช็ค:
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="datetime-local"
                            value={editingDateValue}
                            onChange={(e) => setEditingDateValue(e.target.value)}
                            className="text-xs px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditTime(record.id)}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>บันทึก</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRecordId(null)}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">
                          ผู้ตรวจ: {record.inspector_name}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-slate-400">
                            {formatThaiDate(record.inspection_date, true, true)}
                          </span>
                          {isAdminOrSuper && (
                            <button
                              type="button"
                              onClick={() => handleStartEditTime(record)}
                              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-0.5 font-bold cursor-pointer"
                              title="แก้ไขเวลาตรวจเช็ค (สิทธิ์ P3/P4)"
                            >
                              <Clock className="w-3 h-3" />
                              <span>แก้ไขเวลา</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${record.is_abnormal ? 'text-red-600' : 'text-emerald-600'}`}>
                        {record.is_abnormal ? '✕ พบข้อบกพร่อง' : '✓ ปกติสมบูรณ์'}
                      </span>

                      {record.inspection_photo && (
                        <button
                          onClick={() => onViewImage(record.inspection_photo!, `รูปผลตรวจเช็ค - ${record.inspector_name}`)}
                          className="text-red-600 hover:underline flex items-center space-x-1 font-semibold"
                        >
                          <ZoomIn className="w-3 h-3" />
                          <span>ดูรูปแนบตรวจ</span>
                        </button>
                      )}
                    </div>

                    {record.abnormal_description && (
                      <p className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-100">
                        ปัญหา: {record.abnormal_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            {isAdminOrSuper && onEditEquipment && (
              <button
                onClick={() => {
                  onClose();
                  onEditEquipment(equipment);
                }}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>แก้ไข</span>
              </button>
            )}

            {isAdminOrSuper && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-semibold transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                title="ล้างผลการตรวจเช็คของอุปกรณ์นี้ในรอบเดือนปัจจุบัน"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                <span>ล้างการตรวจรายการนี้</span>
              </button>
            )}

            {isAdminOrSuper && onDeleteEquipment && (
              <button
                onClick={() => {
                  onClose();
                  onDeleteEquipment(equipment.id, equipment.code);
                }}
                className="px-3.5 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบ</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium transition"
            >
              ปิด
            </button>

            {canInspect && (
              <button
                onClick={() => {
                  onClose();
                  onStartInspection(equipment);
                }}
                className="px-4 py-2 bg-[#A04830] hover:bg-[#803A26] text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>เริ่มตรวจเช็ค</span>
              </button>
            )}
          </div>
        </div>
        {/* Clear Month Inspection Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-3 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
              <div className="flex items-center space-x-2 text-rose-600 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>ยืนยันล้างประวัติการตรวจรอบเดือนนี้</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ต้องการล้างประวัติการตรวจเช็คของ <strong>{equipment.code}</strong> ในรอบเดือนนี้หรือไม่?
                <br />
                สถานะอุปกรณ์จะถูกรีเซ็ตกลับเป็น <strong>"ยังไม่ตรวจ" (PENDING)</strong>
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleClearThisEquipmentMonth}
                  className="px-4 py-1.5 rounded-xl text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center space-x-1 shadow-md shadow-rose-200"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isClearing ? 'animate-spin' : ''}`} />
                  <span>{isClearing ? 'กำลังล้าง...' : 'ยืนยันล้างประวัติ'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
