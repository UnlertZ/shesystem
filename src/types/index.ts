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
  is_safety_committee?: boolean; // สิทธิ์ คปอ. (คณะกรรมการความปลอดภัยฯ)
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export type EquipmentType = 'EX' | 'FHC' | 'FH' | 'HD';

export type ReadyStatus = 'READY' | 'NOT_READY';
export type InspectionStatus = 'INSPECTED' | 'PENDING';
export type DefectStatus = 'NORMAL' | 'DEFECT' | 'RESOLVED';

export interface EquipmentPhotoArchiveItem {
  id: string;
  photo_url: string;
  photo_type?: 'INSPECTION' | 'EQUIPMENT' | 'DEFECT';
  year_be: number; // e.g. 2569
  month_idx: number; // 0-11
  month_name: string; // e.g. 'ตุลาคม'
  date: string; // ISO string
  inspector_name?: string;
  note?: string;
  is_abnormal?: boolean;
}

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
  photo_history?: EquipmentPhotoArchiveItem[]; // ประวัติรูปภาพถังจัดเก็บตามปี-เดือน
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
  completed_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
  completion_notes?: string;
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

// ==========================================
// Safety Committee (คปอ.) Data Models
// ==========================================
export type PatrolStatus = 'OPEN' | 'CLOSED';

export interface SafetyPatrolRound {
  id: string;
  title: string;
  patrol_date: string; // YYYY-MM-DD
  start_time: string;  // HH:MM e.g. "10:00"
  end_time: string;    // HH:MM e.g. "11:00"
  time_range: string;  // e.g. "10:00น.-11:00น."
  location?: string;
  description?: string;
  status: PatrolStatus;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at?: string;
  findings_count?: number;
}

export type SafetyFindingCategory = 'RECOMMEND' | 'COMMEND'; // 'RECOMMEND' = แนะนำ, 'COMMEND' = ชมเชย
export type SafetyFindingSubType = 'NEAR_MISS' | 'ACCIDENT' | 'UNSAFE_CONDITION' | 'UNSAFE_ACT' | 'GOOD_PRACTICE';
export type SafetyFindingStatus = 'PENDING_ACTION' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMMENDED';

export interface SafetyFinding {
  id: string;
  patrol_id: string;
  category: SafetyFindingCategory;
  sub_type?: SafetyFindingSubType | string;
  location: string;
  description: string;       // รายละเอียดสิ่งที่พบ หรือ รายละเอียดการชมเชย
  recommendation?: string;  // มาตรการป้องกัน/แก้ไข หรือ ข้อแนะนำ
  photo_url: string;        // รูปก่อนแก้ไข หรือ รูปชมเชย (Cloudflare R2)
  reporter_id: string;
  reporter_name: string;
  reporter_department?: string;
  status: SafetyFindingStatus;
  
  // Before-After Resolution fields
  after_photo_url?: string; // รูปหลังแก้ไข (Cloudflare R2)
  action_taken?: string;    // ระบุว่าแก้ไขอย่างไร
  resolved_by_id?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  
  // Admin Inspection/Review fields
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  reject_reason?: string;   // เหตุผลหากส่งกลับไปแก้ใหม่
  
  created_at: string;
  updated_at?: string;
}
