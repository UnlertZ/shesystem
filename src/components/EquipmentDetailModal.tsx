import React from 'react';
import { Equipment, InspectionRecord } from '../types';
import { formatThaiDate } from '../utils/thaiDate';
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
  ZoomIn
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

  const getTypeTitle = () => {
    switch (equipment.type) {
      case 'EX': return 'ถังดับเพลิง (EX)';
      case 'FHC': return 'ตู้ดับเพลิง (FHC)';
      case 'FH': return 'ตู้สายฉีด (FH)';
      case 'HD': return 'หัวรับน้ำ (HD)';
      default: return equipment.type;
    }
  };

  const getCategoryLabel = () => {
    switch (equipment.type) {
      case 'EX': return 'ชนิดของถังดับเพลิง';
      case 'FHC': return 'ประเภทตู้ดับเพลิง';
      case 'FH': return 'ประเภทตู้สายฉีด';
      case 'HD': return 'ชนิดหัวรับน้ำดับเพลิง';
      default: return 'ชนิด / ประเภท';
    }
  };

  const getWeightLabel = () => {
    switch (equipment.type) {
      case 'EX': return 'น้ำหนักของถัง';
      case 'FHC': return 'ขนาดตู้และสายฉีด';
      case 'FH': return 'ขนาดและระยะสายฉีด';
      case 'HD': return 'ขนาดข้อต่อทางน้ำเข้า';
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

          {/* Photos Section (Click to zoom lightbox) */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
              <span>รูปภาพอุปกรณ์ (คลิกที่รูปเพื่อดูขนาดใหญ่)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {equipment.inspection_sheet_photo ? (
                <div
                  onClick={() => onViewImage(equipment.inspection_sheet_photo!, `รูปภาพใบตรวจเช็ค - ${equipment.code}`)}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-video cursor-pointer bg-slate-900"
                >
                  <img
                    src={equipment.inspection_sheet_photo}
                    alt="ใบตรวจเช็คคู่กับถัง"
                    className="w-full h-full object-cover group-hover:scale-105 group-hover:opacity-90 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white space-x-1 font-medium text-xs">
                    <ZoomIn className="w-4 h-4" />
                    <span>กดดูรูปขนาดใหญ่</span>
                  </div>
                  <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-lg font-medium">
                    รูปภาพใบตรวจเช็ค
                  </span>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 aspect-video flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-4 text-center">
                  <span className="text-[11px]">ไม่มีรูปภาพใบตรวจเช็ค</span>
                </div>
              )}

              {equipment.location_photo ? (
                <div
                  onClick={() => onViewImage(equipment.location_photo!, `รูปสถานที่ติดตั้ง - ${equipment.code}`)}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 aspect-video cursor-pointer bg-slate-900"
                >
                  <img
                    src={equipment.location_photo}
                    alt="สถานที่ติดตั้ง"
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
          </div>

          {/* Inspection History */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
              <History className="w-4 h-4 text-slate-500" />
              <span>ประวัติการตรวจเช็คย้อนหลัง ({inspectionHistory.length} ครั้ง)</span>
            </h4>

            {inspectionHistory.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl text-xs">
                ยังไม่มีประวัติการตรวจเช็คสำหรับอุปกรณ์นี้
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {inspectionHistory.map(record => (
                  <div
                    key={record.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        ผู้ตรวจ: {record.inspector_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatThaiDate(record.inspection_date, true, true)}
                      </span>
                    </div>

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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-200 transition flex items-center space-x-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>เริ่มตรวจเช็ค</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
