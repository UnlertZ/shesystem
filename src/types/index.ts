export type UserRole = 'P1' | 'P2' | 'P3' | 'P4' | 'GUEST';

export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface DepartmentItem {
  id: string;
  name: string;
  created_at?: string;
}

export interface PositionItem {
  id: string;
  name: string;
  default_role: UserRole;
  created_at?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  full_name?: string; // ชื่อจริง นามสกุล
  department: string; // แผนก เช่น แผนกความปลอดภัย (SHE), แผนกผลิต, แผนกคลังสินค้า
  position: string;   // ระดับ/ตำแหน่ง เช่น พนักงาน, หัวหน้างาน, รองผู้จัดการ, ผู้จัดการ
  role: UserRole;     // P1, P2, P3, P4
  status: UserStatus;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export type EquipmentType = 'EX' | 'FHC' | 'FH' | 'HD';

export type ReadyStatus = 'READY' | 'NOT_READY';
export type InspectionStatus = 'INSPECTED' | 'PENDING';
export type DefectStatus = 'NORMAL' | 'DEFECT' | 'RESOLVED';

export interface Equipment {
  id: string;
  type: EquipmentType;
  code: string; // e.g. EX-001, FHC-001, FH-001, HD-001
  sequence_number: number;
  category?: string; // ประเภท เช่น Dry Chemical, CO2, Foam
  weight?: string;   // เช่น 10 lbs, 15 lbs
  location: string;
  in_service_date?: string; // YYYY-MM-DD
  inspection_sheet_photo?: string;
  location_photo?: string;
  ready_status: ReadyStatus;
  inspection_status: InspectionStatus; // ตรวจแล้ว / ยังไม่ตรวจ
  responsible_person: string;
  latest_inspector?: string;
  latest_inspection_date?: string;
  defect_status: DefectStatus;
  defect_notes?: string;
  defect_photo?: string;
  created_at: string;
  updated_at: string;
  // Computed client-side or server-side
  age?: {
    years: number;
    months: number;
    days: number;
    formatted: string;
  };
}

export interface InspectionRecord {
  id: string;
  equipment_id: string;
  equipment_code?: string;
  equipment_type?: EquipmentType;
  inspector_id: string;
  inspector_name: string;
  inspection_date: string;
  ready_status: ReadyStatus;
  checklist_results: Record<string, boolean>;
  inspection_photo?: string;
  location_photo?: string;
  is_abnormal: boolean;
  abnormal_description?: string;
  defect_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  equipment_id?: string;
  equipment_code?: string;
  assigned_by_id: string;
  assigned_by_name: string;
  assigned_to_id: string;
  assigned_to_name: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  task_type: 'INSPECTION' | 'ACTIVITY';
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  recipient_user_id?: string | null;
  target_role?: string; // 'ALL' | 'P1' | 'P2' | 'P3' | 'P4'
  sender_name: string;
  title: string;
  message: string;
  type: 'SYSTEM' | 'ALERT' | 'DEFECT' | 'PASSWORD_RESET' | 'TASK';
  is_read: boolean;
  created_at: string;
}

export interface PasswordResetRequest {
  id: string;
  username: string;
  status: 'PENDING' | 'RESOLVED';
  requested_at: string;
}

// Checklist definitions per equipment type
export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
}
