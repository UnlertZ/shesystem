import React, { useState, useEffect } from 'react';
import { Equipment, EquipmentType, User } from '../types';
import { storageService } from '../services/storage';
import { findLowestVacantNumber, formatEquipmentCode } from '../utils/thaiDate';
import { X, Plus, Save, Camera, Building, Calendar, Scale, Layers, UserCheck } from 'lucide-react';

interface EquipmentFormModalProps {
  equipment?: Equipment | null; // If null, mode is Add
  defaultType?: EquipmentType;
  onClose: () => void;
  onSaved: () => void;
}

export const EquipmentFormModal: React.FC<EquipmentFormModalProps> = ({
  equipment,
  defaultType = 'EX',
  onClose,
  onSaved
}) => {
  const isEdit = !!equipment;

  const [type, setType] = useState<EquipmentType>(equipment ? equipment.type : defaultType);
  const [category, setCategory] = useState(equipment?.category || '');
  const [weight, setWeight] = useState(equipment?.weight || '');
  const [location, setLocation] = useState(equipment?.location || '');
  const [inServiceDate, setInServiceDate] = useState(equipment?.in_service_date || '');
  const [responsiblePerson, setResponsiblePerson] = useState(equipment?.responsible_person || '');
  const [inspectionPhoto, setInspectionPhoto] = useState(equipment?.inspection_sheet_photo || '');
  const [locationPhoto, setLocationPhoto] = useState(equipment?.location_photo || '');

  // Get active registered users to select as responsible person
  const [systemUsers] = useState<User[]>(() =>
    storageService.getUsers().filter(u => u.status === 'approved')
  );

  // Computed next code for Add mode
  const [previewCode, setPreviewCode] = useState('');

  useEffect(() => {
    if (!isEdit) {
      const allEquip = storageService.getEquipment();
      const existingSeqs = allEquip.filter(e => e.type === type).map(e => e.sequence_number);
      const vacant = findLowestVacantNumber(existingSeqs);
      setPreviewCode(formatEquipmentCode(type, vacant));
    } else {
      setPreviewCode(equipment.code);
    }
  }, [type, isEdit, equipment]);

  // Set default responsible person if empty
  useEffect(() => {
    if (!responsiblePerson && systemUsers.length > 0) {
      const defaultUser = systemUsers.find(u => u.role === 'P2') || systemUsers[0];
      setResponsiblePerson(`${defaultUser.username} (${defaultUser.department})`);
    }
  }, [systemUsers, responsiblePerson]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim() || !responsiblePerson.trim()) {
      alert('กรุณากรอกสถานที่ติดตั้งและเลือกผู้รับผิดชอบอุปกรณ์');
      return;
    }

    if (isEdit && equipment) {
      storageService.updateEquipment(equipment.id, {
        category,
        weight,
        location,
        in_service_date: inServiceDate,
        responsible_person: responsiblePerson,
        inspection_sheet_photo: inspectionPhoto || undefined,
        location_photo: locationPhoto || undefined
      });
    } else {
      storageService.addEquipment({
        type,
        category,
        weight,
        location,
        in_service_date: inServiceDate,
        responsible_person: responsiblePerson,
        inspection_sheet_photo: inspectionPhoto || undefined,
        location_photo: locationPhoto || undefined,
        ready_status: 'READY',
        inspection_status: 'PENDING',
        defect_status: 'NORMAL'
      });
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              {isEdit ? `แก้ไขข้อมูล: ${equipment?.code}` : 'เพิ่มอุปกรณ์ใหม่'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              จัดการข้อมูลรายละเอียดอุปกรณ์ความปลอดภัย
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-slate-700 flex-1">
          {/* Equipment Code & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">ประเภทอุปกรณ์</label>
              <select
                value={type}
                disabled={isEdit}
                onChange={(e) => setType(e.target.value as EquipmentType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:bg-slate-100"
              >
                <option value="EX">ถังดับเพลิง (EX)</option>
                <option value="FHC">ตู้ดับเพลิง (FHC)</option>
                <option value="FH">ตู้สายฉีด (FH)</option>
                <option value="HD">หัวรับน้ำ (HD)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                รหัสอุปกรณ์
              </label>
              <div className="px-3.5 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700">
                {previewCode}
              </div>
            </div>
          </div>

          {/* Category & Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>ชนิด / ประเภทของถังหรือตู้</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="เช่น Dry Chemical, CO2, Foam"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                <span>น้ำหนัก / ขนาด</span>
              </label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="เช่น 10 lbs, 15 lbs, 2.5 นิ้ว"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* Location & In-Service Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>สถานที่ติดตั้ง *</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น อาคาร A ชั้น 1 ประตูหนีไฟ"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันที่เริ่มใช้งานถัง/อุปกรณ์</span>
              </label>
              <input
                type="date"
                value={inServiceDate}
                onChange={(e) => setInServiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          {/* Responsible Person: Dropdown populated from users in system */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>ผู้รับผิดชอบอุปกรณ์ (เลือกจากสมาชิกในระบบ เพื่อรับการแจ้งเตือนรอบเดือน) *</span>
            </label>
            <select
              value={responsiblePerson}
              onChange={(e) => setResponsiblePerson(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
              required
            >
              <option value="">-- เลือกผู้รับผิดชอบ --</option>
              {systemUsers.map(u => {
                const label = `${u.username} (${u.department}) - สิทธิ์ ${u.role}`;
                const val = `${u.username} (${u.department})`;
                return (
                  <option key={u.id} value={val}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Photo upload sections without sample photo buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">รูปภาพใบตรวจเช็คคู่กับถัง</label>
              </div>
              {inspectionPhoto ? (
                <div className="relative group h-28 rounded-xl overflow-hidden border border-slate-200">
                  <img src={inspectionPhoto} alt="ใบตรวจเช็ค" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setInspectionPhoto('')}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full text-xs shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-slate-300 rounded-xl h-28 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition bg-slate-50">
                  <Camera className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-500">อัปโหลดรูปใบตรวจ</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, setInspectionPhoto)}
                  />
                </label>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">รูปสถานที่ติดตั้ง</label>
              </div>
              {locationPhoto ? (
                <div className="relative group h-28 rounded-xl overflow-hidden border border-slate-200">
                  <img src={locationPhoto} alt="สถานที่" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setLocationPhoto('')}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full text-xs shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-slate-300 rounded-xl h-28 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition bg-slate-50">
                  <Camera className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-[11px] text-slate-500">อัปโหลดรูปสถานที่</span>
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

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-200 flex items-center space-x-1.5"
            >
              {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มอุปกรณ์ใหม่'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
