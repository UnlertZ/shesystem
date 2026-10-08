import React, { useState } from 'react';
import { Equipment, User, Task } from '../types';
import { EQUIPMENT_CHECKLISTS } from '../utils/equipmentChecklists';
import { storageService, uploadToR2 } from '../services/storage';
import { X, CheckCircle2, AlertTriangle, Camera, Upload, AlertCircle, Sparkles } from 'lucide-react';
import { calculateEquipmentAge } from '../utils/thaiDate';

interface InspectionModalProps {
  equipment: Equipment;
  currentUser: User;
  assignedTask?: Task;
  onClose: () => void;
  onInspectionComplete: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  equipment,
  currentUser,
  assignedTask,
  onClose,
  onInspectionComplete
}) => {
  const checklistDef = EQUIPMENT_CHECKLISTS[equipment.type] || EQUIPMENT_CHECKLISTS.EX;
  
  // Initialize checklist items state (all default true/pass)
  const [checklistResults, setChecklistResults] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    checklistDef.items.forEach(item => {
      init[item.id] = true;
    });
    return init;
  });

  const [isAbnormal, setIsAbnormal] = useState(equipment.defect_status === 'DEFECT');
  const [abnormalDescription, setAbnormalDescription] = useState(equipment.defect_notes || '');
  const [isResolved, setIsResolved] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');

  // Photos
  const [inspectionPhoto, setInspectionPhoto] = useState<string>(equipment.inspection_sheet_photo || '');
  const [locationPhoto, setLocationPhoto] = useState<string>(equipment.location_photo || '');
  const [defectPhoto, setDefectPhoto] = useState<string>(equipment.defect_photo || '');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const age = calculateEquipmentAge(equipment.in_service_date, equipment.latest_inspection_date);

  // Toggle single checklist item
  const handleToggleChecklist = (itemId: string) => {
    setChecklistResults(prev => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      // If any item fails, suggest marking abnormal
      const anyFailed = Object.values(next).some(v => v === false);
      if (anyFailed && !isAbnormal) {
        setIsAbnormal(true);
      }
      return next;
    });
  };

  // Convert uploaded image to R2 url (or fallback to base64) for reliable storage and display
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadToR2(file);
        setter(url);
      } catch (err) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setter(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Verification: Photos required
    if (!inspectionPhoto) {
      setErrorMessage('กรุณาแนบรูปภาพใบตรวจเช็คคู่กับอุปกรณ์ทุกครั้ง');
      return;
    }

    if (!locationPhoto) {
      setErrorMessage('กรุณาแนบรูปสถานที่ติดตั้งอุปกรณ์ทุกครั้ง');
      return;
    }

    // Verification: If abnormal, description is required
    if (isAbnormal && !abnormalDescription.trim()) {
      setErrorMessage('เมื่อพบความผิดปกติ กรุณาระบุรายละเอียดและสาเหตุความผิดปกติให้ชัดเจน');
      return;
    }

    setIsSubmitting(true);

    const inspectorDisplayName = currentUser.full_name ? `${currentUser.full_name} (${currentUser.username})` : currentUser.username;

    try {
      storageService.submitInspection({
        equipment_id: equipment.id,
        inspector_id: currentUser.id,
        inspector_name: inspectorDisplayName,
        ready_status: isAbnormal ? 'NOT_READY' : 'READY',
        checklist_results: checklistResults,
        inspection_photo: inspectionPhoto,
        location_photo: locationPhoto,
        is_abnormal: isAbnormal,
        abnormal_description: abnormalDescription,
        defect_resolved: isResolved,
        task_id: assignedTask?.id
      });

      // If user checked resolve defect
      if (isResolved && equipment.defect_status === 'DEFECT') {
        storageService.resolveDefect(equipment.id, resolveNotes || 'แก้ไขตามมาตรฐานเรียบร้อย', inspectorDisplayName);
      }

      onInspectionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-800">แบบฟอร์มตรวจสอบ: {equipment.code}</span>
              <span className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                {equipment.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              สถานที่: {equipment.location} | อายุอุปกรณ์: {age.formatted}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Assigned Task Banner */}
          {assignedTask && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center justify-between">
              <div>
                <span className="font-bold">งานที่ได้รับมอบหมาย:</span> {assignedTask.title}
                <div className="text-[11px] text-blue-600">มอบหมายโดย: {assignedTask.assigned_by_name}</div>
              </div>
              <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-semibold">มอบหมายแล้ว</span>
            </div>
          )}

          {/* Existing Defect Notice & Resolution Option */}
          {equipment.defect_status === 'DEFECT' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>อุปกรณ์นี้มีประวัติพบข้อบกพร่องอยู่:</span>
              </div>
              <p className="text-xs text-amber-700 pl-6">{equipment.defect_notes}</p>
              
              <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isResolved}
                    onChange={(e) => {
                      setIsResolved(e.target.checked);
                      if (e.target.checked) setIsAbnormal(false);
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-emerald-700">
                    บันทึกว่าแก้ไขปัญหาแล้ว (Mark as Resolved)
                  </span>
                </label>
              </div>

              {isResolved && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="ระบุรายละเอียดการแก้ไข เช่น เปลี่ยนสายฉีดใหม่เรียบร้อย..."
                    className="w-full text-xs px-3 py-2 bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}
            </div>
          )}

          {/* 1. Checklist Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>รายการตรวจสอบ ({checklistDef.name})</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  const allPass: Record<string, boolean> = {};
                  checklistDef.items.forEach(i => (allPass[i.id] = true));
                  setChecklistResults(allPass);
                }}
                className="text-[11px] text-emerald-600 hover:underline font-semibold"
              >
                ผ่านทั้งหมด
              </button>
            </div>

            <div className="space-y-2">
              {checklistDef.items.map((item, idx) => {
                const passed = checklistResults[item.id] !== false;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      passed
                        ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                        : 'bg-red-50 border-red-300 text-red-900'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <span className="text-xs font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                      <div>
                        <p className={`text-xs font-semibold ${passed ? 'text-slate-800' : 'text-red-700'}`}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold shrink-0 ml-3 ${
                        passed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {passed ? 'ปกติ / ผ่าน' : 'ไม่ผ่าน'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Mandatory Photo Uploads */}
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
              <Camera className="w-4 h-4 text-red-600" />
              <span>แนบรูปภาพการตรวจเช็ค (จำเป็นต้องแนบทุกครั้ง)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Photo 1: Inspection Sheet + Tank */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">1. รูปใบตรวจเช็คคู่กับอุปกรณ์ *</label>
                </div>
                {inspectionPhoto ? (
                  <div className="relative group rounded-xl overflow-hidden aspect-video bg-black/5 border border-slate-200">
                    <img src={inspectionPhoto} alt="ใบตรวจเช็ค" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setInspectionPhoto('')}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full text-xs shadow-md opacity-90 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer transition bg-white">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-medium">กดเพื่อถ่ายรูป / อัปโหลด</span>
                    <span className="text-[10px] text-slate-400">รองรับไฟล์ JPG, PNG</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setInspectionPhoto)}
                    />
                  </label>
                )}
              </div>

              {/* Photo 2: Location Photo */}
              <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">2. รูปสถานที่ติดตั้งอุปกรณ์ *</label>
                </div>
                {locationPhoto ? (
                  <div className="relative group rounded-xl overflow-hidden aspect-video bg-black/5 border border-slate-200">
                    <img src={locationPhoto} alt="สถานที่ติดตั้ง" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setLocationPhoto('')}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full text-xs shadow-md opacity-90 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer transition bg-white">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-medium">กดเพื่อถ่ายรูป / อัปโหลด</span>
                    <span className="text-[10px] text-slate-400">รองรับไฟล์ JPG, PNG</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setLocationPhoto)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* 3. Defect & Abnormality Reporting */}
          <div className="pt-2 border-t border-slate-200">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAbnormal}
                  onChange={(e) => setIsAbnormal(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-xs font-bold text-red-600 flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span>พบความผิดปกติ / ชำรุด (จะส่งการแจ้งเตือนไปยังแอดมินทันที)</span>
                </span>
              </label>

              {isAbnormal && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      อธิบายรายละเอียดความผิดปกติ *
                    </label>
                    <textarea
                      value={abnormalDescription}
                      onChange={(e) => setAbnormalDescription(e.target.value)}
                      placeholder="ระบุข้อบกพร่องที่พบ เช่น เกจ์วัดความดันตก, วาล์วน้ำซึม, สายฉีดแตกลายงา..."
                      rows={3}
                      className="w-full text-xs p-3 bg-white border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                      required={isAbnormal}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        แนบรูปจุดที่พบความผิดปกติ
                      </label>
                    </div>
                    {defectPhoto ? (
                      <div className="relative group w-36 h-24 rounded-lg overflow-hidden border border-red-200">
                        <img src={defectPhoto} alt="จุดชำรุด" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setDefectPhoto('')}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="border border-dashed border-red-300 rounded-xl p-3 flex items-center space-x-2 cursor-pointer bg-white hover:bg-red-50/30 transition">
                        <Camera className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-slate-600">แนบภาพจุดชำรุด</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, setDefectPhoto)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition flex items-center space-x-1.5 ${
                isAbnormal
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                  : 'bg-red-600 hover:bg-red-700 shadow-red-200'
              }`}
            >
              {isSubmitting ? (
                <span>กำลังบันทึก...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกผลการตรวจสอบ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
