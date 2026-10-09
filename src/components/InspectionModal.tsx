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
  
  // Initialize checklist items state (Empty - Inspector must manually select each item)
  const [checklistResults, setChecklistResults] = useState<Record<string, boolean>>({});

  const [isAbnormal, setIsAbnormal] = useState(equipment.defect_status === 'DEFECT');
  const [abnormalDescription, setAbnormalDescription] = useState(equipment.defect_notes || '');
  const [isResolved, setIsResolved] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');

  // Previous tank photo before this inspection
  const previousTankPhoto = equipment.inspection_sheet_photo || '';
  // Photos: Inspection photo only (New inspection photo starts empty so inspector attaches fresh photo)
  const [inspectionPhoto, setInspectionPhoto] = useState<string>('');
  const [defectPhoto, setDefectPhoto] = useState<string>(equipment.defect_photo || '');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const age = calculateEquipmentAge(equipment.in_service_date, equipment.latest_inspection_date);

  // Set explicit status for a single checklist item (Requirement 2)
  const handleSetChecklistStatus = (itemId: string, passed: boolean) => {
    setChecklistResults(prev => {
      const next = { ...prev, [itemId]: passed };
      // If user marks any item as failed, automatically flag abnormal
      if (!passed && !isAbnormal) {
        setIsAbnormal(true);
      }
      return next;
    });
  };

  // Convert uploaded image to R2 url (or fallback to base64) with automatic client-side compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadToR2(file);
        setter(url);
      } catch (err) {
        console.error('Upload photo error:', err);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Requirement 2 Verification: User must manually choose pass/fail for EVERY item
    const unselectedItems = checklistDef.items.filter(item => checklistResults[item.id] === undefined);
    if (unselectedItems.length > 0) {
      setErrorMessage(`กรุณากดเลือกผลการตรวจ (ผ่าน หรือ ไม่ผ่าน) ให้ครบทุกข้อด้วยตนเอง (เหลืออีก ${unselectedItems.length} ข้อที่ยังไม่ได้เลือก)`);
      return;
    }

    // Requirement 1 Verification: Only inspection photo required, no location photo
    if (!inspectionPhoto) {
      setErrorMessage('กรุณาแนบรูปตรวจ (รูปภาพการตรวจเช็คคู่กับอุปกรณ์) ทุกครั้ง');
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
        location_photo: undefined,
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
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>รายการตรวจสอบ ({checklistDef.name})</span>
                </h4>
                <p className="text-[11px] text-amber-600 mt-0.5 font-medium">
                  * ผู้ตรวจต้องกดเลือก ผ่าน หรือ ไม่ผ่าน ให้ครบทุกข้อด้วยตนเอง
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                เลือกแล้ว {Object.keys(checklistResults).length} / {checklistDef.items.length}
              </span>
            </div>

            <div className="space-y-2">
              {checklistDef.items.map((item, idx) => {
                const itemStatus = checklistResults[item.id];
                const isSelected = itemStatus !== undefined;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !isSelected
                        ? 'bg-slate-50/70 border-amber-200/80'
                        : itemStatus
                        ? 'bg-emerald-50/30 border-emerald-200'
                        : 'bg-red-50/40 border-red-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 flex-1">
                      <span className="text-xs font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                      <div>
                        <p className={`text-xs font-bold ${
                          !isSelected ? 'text-slate-800' : itemStatus ? 'text-slate-800' : 'text-red-700'
                        }`}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                        )}
                        {!isSelected && (
                          <span className="inline-block mt-1 text-[10px] text-amber-700 font-semibold bg-amber-100/70 px-2 py-0.5 rounded-md">
                            ยังไม่ได้เลือกผลตรวจ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Manual Choice Buttons (Requirement 2) */}
                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleSetChecklistStatus(item.id, true)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs ${
                          itemStatus === true
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/40'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-500 hover:text-emerald-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>ผ่าน</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetChecklistStatus(item.id, false)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs ${
                          itemStatus === false
                            ? 'bg-red-600 text-white ring-2 ring-red-500/40'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-red-500 hover:text-red-700'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>ไม่ผ่าน</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Mandatory Photo Upload - Inspection Photo Replaces Tank Photo */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                <span>แนบรูปตรวจ (รูปภาพตรวจเช็คคู่กับอุปกรณ์) *</span>
              </h4>
              <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                รูปนี้จะแทนรูปถังทันที
              </span>
            </div>

            {/* Explanatory Notice */}
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-800 flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>ระบบจะอัปเดตรูปถังอัตโนมัติ:</strong> รูปที่แนบตรวจรอบนี้จะถูกนำไปแทนรูปถังปัจจุบันทันที และรูปถังเดิมจะถูกจัดเก็บเข้าคลังประวัติตามปี-เดือนอย่างปลอดภัย
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Previous Tank Photo (if available) */}
              {previousTankPhoto && (
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>รูปถังเดิมในระบบ</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                      จะย้ายไปเก็บในประวัติ
                    </span>
                  </div>
                  <div className="rounded-xl overflow-hidden aspect-video bg-black/5 border border-slate-200">
                    <img src={previousTankPhoto} alt="รูปถังเดิม" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-[10px] text-slate-400 text-center">
                    ถ่ายไว้รอบก่อนหน้านี้
                  </div>
                </div>
              )}

              {/* New Inspection Photo (Replaces Tank Photo) */}
              <div className={`border rounded-2xl p-3 ${
                inspectionPhoto ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'
              } ${!previousTankPhoto ? 'sm:col-span-2' : ''}`}>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                  <span>แนบรูปตรวจเช็คใหม่ *</span>
                  {inspectionPhoto && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full font-bold">
                      ✓ พร้อมแทนรูปถัง
                    </span>
                  )}
                </div>

                {inspectionPhoto ? (
                  <div className="relative group rounded-xl overflow-hidden aspect-video bg-black/5 border border-emerald-200 mx-auto">
                    <img src={inspectionPhoto} alt="รูปตรวจคู่กับอุปกรณ์" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setInspectionPhoto('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full text-xs shadow-md opacity-90 group-hover:opacity-100 transition"
                      title="ลบรูปเพื่อถ่ายใหม่"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded text-center font-medium">
                      รูปตรวจเช็คใหม่ (จะบันทึกเป็นรูปถังล่าสุด)
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer transition bg-white p-4 text-center">
                    <Upload className="w-7 h-7 text-blue-500 mb-1" />
                    <span className="text-xs text-blue-700 font-bold">กดเพื่อถ่ายรูป หรือ อัปโหลดรูปตรวจ</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">ภาพตรวจเช็คคู่กับถัง (ระบบลดขนาดภาพให้อัตโนมัติเพื่อประหยัดพื้นที่)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setInspectionPhoto)}
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
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-xs'
                  : 'bg-[#A04830] hover:bg-[#803A26] shadow-xs'
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
