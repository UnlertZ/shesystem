import React, { useState } from 'react';
import { Equipment, EquipmentType, User, Task } from '../types';
import { storageService } from '../services/storage';
import { InspectionModal } from './InspectionModal';
import { EquipmentFormModal } from './EquipmentFormModal';
import {
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckSquare,
  Wrench,
  ShieldAlert,
  Calendar,
  Layers,
  MapPin,
  User as UserIcon,
  Info
} from 'lucide-react';
import { formatThaiDate } from '../utils/thaiDate';

interface EquipmentInspectionPageProps {
  currentUser: User | null;
  tasks: Task[];
  onRefreshTasks: () => void;
}

export const EquipmentInspectionPage: React.FC<EquipmentInspectionPageProps> = ({
  currentUser,
  tasks,
  onRefreshTasks
}) => {
  const [activeType, setActiveType] = useState<EquipmentType>('EX');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>(() => storageService.getEquipment());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INSPECTED' | 'PENDING' | 'DEFECT' | 'RESOLVED'>('ALL');

  // Modals state
  const [inspectingEquipment, setInspectingEquipment] = useState<Equipment | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [permissionErrorModal, setPermissionErrorModal] = useState<string | null>(null);

  const refreshEquipment = () => {
    setEquipmentList(storageService.getEquipment());
    onRefreshTasks();
  };

  const isAdminOrSuper = currentUser?.role === 'P3' || currentUser?.role === 'P4';
  const isSupervisorOrAbove = currentUser?.role === 'P2' || isAdminOrSuper;

  // Filter by equipment type tab
  const currentTabEquipment = equipmentList.filter(e => e.type === activeType);

  // Apply search & status filter
  const filteredEquipment = currentTabEquipment.filter(item => {
    const matchesSearch =
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.responsible_person.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'INSPECTED') return item.inspection_status === 'INSPECTED';
    if (statusFilter === 'PENDING') return item.inspection_status === 'PENDING';
    if (statusFilter === 'DEFECT') return item.defect_status === 'DEFECT';
    if (statusFilter === 'RESOLVED') return item.defect_status === 'RESOLVED';

    return true;
  });

  // Calculate statistics for the active tab
  const totalCount = currentTabEquipment.length;
  const inspectedCount = currentTabEquipment.filter(e => e.inspection_status === 'INSPECTED').length;
  const pendingCount = currentTabEquipment.filter(e => e.inspection_status === 'PENDING').length;
  const defectCount = currentTabEquipment.filter(e => e.defect_status === 'DEFECT').length;
  const resolvedCount = currentTabEquipment.filter(e => e.defect_status === 'RESOLVED').length;

  // Check if current user (P1) is assigned/delegated to inspect this equipment
  const getAssignedTaskForEquipment = (equipId: string): Task | undefined => {
    if (!currentUser) return undefined;
    return tasks.find(
      t => t.equipment_id === equipId &&
           t.assigned_to_id === currentUser.id &&
           t.status !== 'COMPLETED'
    );
  };

  // Inspect button click with P1 permission check
  const handleStartInspection = (equip: Equipment) => {
    if (!currentUser || currentUser.role === 'GUEST') {
      setPermissionErrorModal('ผู้เยี่ยมชม (Guest) ไม่มีสิทธิ์ทำการตรวจเช็คอุปกรณ์ กรุณาเข้าสู่ระบบด้วยบัญชีพนักงาน');
      return;
    }

    // Role P1 requirement:
    // "P1 พนักงาน(เมื่อได้รับอนุญาติจากP2สามารถตรวจเช็คแทนได้)"
    if (currentUser.role === 'P1') {
      const assigned = getAssignedTaskForEquipment(equip.id);
      if (!assigned) {
        setPermissionErrorModal(
          `พนักงาน (สิทธิ์ P1) สามารถตรวจเช็คได้เมื่อได้รับอนุญาตหรือมอบหมายงานจากหัวหน้างาน (P2) เท่านั้น\n\nอุปกรณ์ ${equip.code} นี้ยังไม่ได้รับมอบหมายให้คุณ`
        );
        return;
      }
    }

    setInspectingEquipment(equip);
  };

  const handleDeleteEquipment = (id: string, code: string) => {
    if (!isAdminOrSuper) return;
    if (confirm(`คุณแน่ใจหรือไม่ที่จะลบอุปกรณ์ ${code}?\n\n*หมายเหตุ: เมื่อลบแล้ว รหัส ${code} จะกลายเป็นช่องว่าง และการเพิ่มอุปกรณ์ใหม่จะถูกนำมารันแทนที่ตัวนี้ทันที`)) {
      storageService.deleteEquipment(id);
      refreshEquipment();
    }
  };

  const getTabLabel = (type: EquipmentType) => {
    switch (type) {
      case 'EX': return '1. ถังดับเพลิง (EX)';
      case 'FHC': return '2. ตู้ดับเพลิง (FHC)';
      case 'FH': return '3. ตู้สายฉีด (FH)';
      case 'HD': return '4. หัวรับน้ำ (HD)';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Flame className="w-6 h-6" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">ระบบตรวจสอบอุปกรณ์ดับเพลิง</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ตรวจเช็คอุปกรณ์ตามรอบประจำเดือน พร้อมระบบจัดเก็บประวัติและแจ้งเตือนข้อบกพร่อง
          </p>
        </div>

        {/* Admin Action Button */}
        {isAdminOrSuper && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-200 transition flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มอุปกรณ์ใหม่</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Tabs Selector */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        {(['EX', 'FHC', 'FH', 'HD'] as EquipmentType[]).map((tab) => {
          const isActive = activeType === tab;
          const count = equipmentList.filter(e => e.type === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveType(tab)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-bold rounded-t-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'border-b-2 border-red-600 text-red-600 bg-red-50/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{getTabLabel(tab)}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                isActive ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Statistics Chips Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] opacity-80">ทั้งหมด ({activeType})</div>
          <div className="text-xl font-bold mt-0.5">{totalCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('INSPECTED')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'INSPECTED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] opacity-80 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ตรวจแล้ว</span>
          </div>
          <div className="text-xl font-bold mt-0.5">{inspectedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'PENDING' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] opacity-80 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>ยังไม่ตรวจ</span>
          </div>
          <div className="text-xl font-bold mt-0.5">{pendingCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('DEFECT')}
          className={`p-3 rounded-2xl border transition cursor-pointer ${
            statusFilter === 'DEFECT' ? 'bg-red-600 text-white border-red-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] opacity-80 flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>พบปัญหา</span>
          </div>
          <div className="text-xl font-bold mt-0.5">{defectCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('RESOLVED')}
          className={`p-3 rounded-2xl border transition cursor-pointer col-span-2 sm:col-span-1 ${
            statusFilter === 'RESOLVED' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] opacity-80 flex items-center space-x-1">
            <Wrench className="w-3.5 h-3.5" />
            <span>แก้ไขแล้ว</span>
          </div>
          <div className="text-xl font-bold mt-0.5">{resolvedCount}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหารหัส, สถานที่, ผู้รับผิดชอบ..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        {currentUser?.role === 'P1' && (
          <div className="text-xs bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200 flex items-center space-x-1.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>คุณอยู่ในสิทธิ์ P1: สามารถตรวจเช็คได้เฉพาะรายการที่หัวหน้างาน (P2) มอบหมาย</span>
          </div>
        )}
      </div>

      {/* Equipment Cards Grid */}
      {filteredEquipment.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
          <p className="text-sm font-semibold text-slate-600">ไม่พบรายการอุปกรณ์ตามเงื่อนไขที่เลือก</p>
          <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดเพิ่มอุปกรณ์ใหม่</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipment.map((equip) => {
            const assigned = getAssignedTaskForEquipment(equip.id);
            const canInspect = isSupervisorOrAbove || !!assigned;

            return (
              <div
                key={equip.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-base text-slate-900">{equip.code}</span>
                      {equip.inspection_status === 'INSPECTED' ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ตรวจแล้ว</span>
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>ยังไม่ตรวจ</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {equip.defect_status === 'DEFECT' ? (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>พบปัญหา</span>
                        </span>
                      ) : equip.defect_status === 'RESOLVED' ? (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <Wrench className="w-3 h-3" />
                          <span>แก้ไขแล้ว</span>
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          ปกติ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body & Details */}
                  <div className="p-4 space-y-3 text-xs">
                    {/* Location */}
                    <div className="flex items-start space-x-2 text-slate-700">
                      <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">สถานที่:</span> {equip.location}
                      </div>
                    </div>

                    {/* Specific details for EX */}
                    {equip.type === 'EX' && (
                      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-xl text-[11px] text-slate-600">
                        <div>
                          <span className="font-medium text-slate-400">ประเภท:</span>{' '}
                          <span className="font-semibold text-slate-800">{equip.category || '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-400">น้ำหนัก:</span>{' '}
                          <span className="font-semibold text-slate-800">{equip.weight || '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-400">เริ่มใช้งาน:</span>{' '}
                          <span className="font-semibold text-slate-800">{equip.in_service_date || '-'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-400">อายุถัง:</span>{' '}
                          <span className="font-semibold text-red-600">{equip.age?.formatted || '-'}</span>
                        </div>
                      </div>
                    )}

                    {/* Defect note if present */}
                    {equip.defect_notes && (
                      <div className={`p-2.5 rounded-xl border text-[11px] ${
                        equip.defect_status === 'DEFECT'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        <div className="font-bold flex items-center space-x-1 mb-0.5">
                          {equip.defect_status === 'DEFECT' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
                          <span>{equip.defect_status === 'DEFECT' ? 'ข้อบกพร่องที่พบ:' : 'บันทึกการแก้ไข:'}</span>
                        </div>
                        <p>{equip.defect_notes}</p>
                      </div>
                    )}

                    {/* People & Dates */}
                    <div className="space-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <div>
                        <span className="font-medium">ผู้รับผิดชอบ:</span> {equip.responsible_person}
                      </div>
                      <div>
                        <span className="font-medium">ตรวจล่าสุด:</span>{' '}
                        {equip.latest_inspection_date ? formatThaiDate(equip.latest_inspection_date, true) : 'ยังไม่มีประวัติ'}
                        {equip.latest_inspector && ` โดย ${equip.latest_inspector}`}
                      </div>
                    </div>

                    {/* Photos Preview */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {equip.inspection_sheet_photo ? (
                        <div className="rounded-lg overflow-hidden border border-slate-200 aspect-video relative group">
                          <img
                            src={equip.inspection_sheet_photo}
                            alt="ใบตรวจเช็ค"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.2 rounded font-medium">
                            ใบตรวจเช็ค
                          </span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 aspect-video flex items-center justify-center text-[10px] text-slate-400 bg-slate-50">
                          ไม่มีรูปใบตรวจ
                        </div>
                      )}

                      {equip.location_photo ? (
                        <div className="rounded-lg overflow-hidden border border-slate-200 aspect-video relative group">
                          <img
                            src={equip.location_photo}
                            alt="สถานที่"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.2 rounded font-medium">
                            รูปสถานที่
                          </span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 aspect-video flex items-center justify-center text-[10px] text-slate-400 bg-slate-50">
                          ไม่มีรูปสถานที่
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    {isAdminOrSuper && (
                      <>
                        <button
                          onClick={() => setEditingEquipment(equip)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-slate-200 rounded-lg transition"
                          title="แก้ไขข้อมูลอุปกรณ์"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEquipment(equip.id, equip.code)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="ลบอุปกรณ์"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartInspection(equip)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5 ${
                      canInspect
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>
                      {currentUser?.role === 'P1' && !assigned ? 'ต้องขออนุญาต P2' : 'ตรวจเช็คอุปกรณ์'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspection Modal */}
      {inspectingEquipment && currentUser && (
        <InspectionModal
          equipment={inspectingEquipment}
          currentUser={currentUser}
          assignedTask={getAssignedTaskForEquipment(inspectingEquipment.id)}
          onClose={() => setInspectingEquipment(null)}
          onInspectionComplete={() => {
            setInspectingEquipment(null);
            refreshEquipment();
          }}
        />
      )}

      {/* Add / Edit Equipment Modal */}
      {(isAddModalOpen || editingEquipment) && (
        <EquipmentFormModal
          equipment={editingEquipment}
          defaultType={activeType}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEquipment(null);
          }}
          onSaved={() => {
            setIsAddModalOpen(false);
            setEditingEquipment(null);
            refreshEquipment();
          }}
        />
      )}

      {/* Permission Warning Dialog */}
      {permissionErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-800">แจ้งเตือนสิทธิ์การใช้งาน</h4>
            <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
              {permissionErrorModal}
            </p>
            <button
              onClick={() => setPermissionErrorModal(null)}
              className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
