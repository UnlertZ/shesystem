import {
  User,
  Equipment,
  InspectionRecord,
  Task,
  AppNotification,
  PasswordResetRequest,
  EquipmentType,
  UserRole,
  DepartmentItem,
  PositionItem
} from '../types';
import {
  findLowestVacantNumber,
  formatEquipmentCode,
  calculateEquipmentAge,
  isOlderThan3Years,
  getNowThai,
  THAI_MONTHS
} from '../utils/thaiDate';

const STORAGE_KEYS = {
  USERS: 'she_users_prod_v1',
  DEPARTMENTS: 'she_departments_prod_v1',
  POSITIONS: 'she_positions_prod_v1',
  EQUIPMENT: 'she_equipment_prod_v1',
  INSPECTIONS: 'she_inspections_prod_v1',
  TASKS: 'she_tasks_prod_v1',
  NOTIFICATIONS: 'she_notifications_prod_v1',
  PASSWORD_RESETS: 'she_password_resets_prod_v1',
  CURRENT_USER: 'she_current_user_prod_v1'
};

// Initial Default Departments (แผนก)
const DEFAULT_DEPARTMENTS: DepartmentItem[] = [
  { id: 'dept_01', name: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)' },
  { id: 'dept_02', name: 'แผนกผลิต (Production)' },
  { id: 'dept_03', name: 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)' },
  { id: 'dept_04', name: 'แผนกซ่อมบำรุงและวิศวกรรม (Maintenance & Engineering)' },
  { id: 'dept_05', name: 'แผนกทรัพยากรบุคคลและธุรการ (HR & Admin)' },
  { id: 'dept_06', name: 'แผนกควบคุมคุณภาพ (QC & QA)' }
];

// Initial Default Positions / Levels (ระดับ / ตำแหน่ง)
const DEFAULT_POSITIONS: PositionItem[] = [
  { id: 'pos_01', name: 'พนักงาน', default_role: 'P1' },
  { id: 'pos_02', name: 'หัวหน้างาน', default_role: 'P2' },
  { id: 'pos_03', name: 'รองผู้จัดการ', default_role: 'P2' },
  { id: 'pos_04', name: 'ผู้จัดการ', default_role: 'P2' },
  { id: 'pos_05', name: 'เจ้าหน้าที่ความปลอดภัย (จป.)', default_role: 'P3' },
  { id: 'pos_06', name: 'ผู้จัดการระบบ (IT / Super Admin)', default_role: 'P4' }
];

// Initial Default Users with separated department & position, and real database passwords
const DEFAULT_USERS: User[] = [
  {
    id: 'u_p4_01',
    username: 'superadmin',
    password: 'admin123',
    department: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)',
    position: 'ผู้จัดการระบบ (IT / Super Admin)',
    role: 'P4',
    status: 'approved',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  },
  {
    id: 'u_p3_01',
    username: 'admin',
    password: 'admin123',
    department: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)',
    position: 'เจ้าหน้าที่ความปลอดภัย (จป.)',
    role: 'P3',
    status: 'approved',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  },
  {
    id: 'u_p2_01',
    username: 'supervisor1',
    password: '123456',
    department: 'แผนกผลิต (Production)',
    position: 'หัวหน้างาน',
    role: 'P2',
    status: 'approved',
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  },
  {
    id: 'u_p1_01',
    username: 'staff1',
    password: '123456',
    department: 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)',
    position: 'พนักงาน',
    role: 'P1',
    status: 'approved',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  }
];

// Initial Equipment - Clean Production Database (No sample data)
const DEFAULT_EQUIPMENT: Equipment[] = [];

// Initial Tasks - Clean Production Database
const DEFAULT_TASKS: Task[] = [];

// Initial Notifications - Clean Production Database
const DEFAULT_NOTIFICATIONS: AppNotification[] = [];

class StorageService {
  private isBrowser = typeof window !== 'undefined';

  constructor() {
    this.initData();
  }

  private initData() {
    if (!this.isBrowser) return;

    // Purge legacy mock storage keys to prevent mock data (like EX-001) from respawning
    const oldKeys = [
      'she_equipment_v1', 'she_equipment_v2', 'she_equipment_v3', 'she_equipment_v4',
      'she_tasks_v1', 'she_tasks_v2', 'she_tasks_v3', 'she_tasks_v4',
      'she_notifications_v1', 'she_notifications_v2', 'she_notifications_v3', 'she_notifications_v4'
    ];
    oldKeys.forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    if (!localStorage.getItem(STORAGE_KEYS.DEPARTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(DEFAULT_DEPARTMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.POSITIONS)) {
      localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(DEFAULT_POSITIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EQUIPMENT)) {
      localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.INSPECTIONS)) {
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PASSWORD_RESETS)) {
      localStorage.setItem(STORAGE_KEYS.PASSWORD_RESETS, JSON.stringify([]));
    }

    // Safety cleanup: If current storage still has any legacy mock equipment IDs, remove them immediately
    try {
      const storedEquip = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
      if (storedEquip) {
        const parsed: Equipment[] = JSON.parse(storedEquip);
        const cleaned = parsed.filter(e => 
          !e.id.startsWith('eq_ex_00') &&
          !e.id.startsWith('eq_fhc_00') &&
          !e.id.startsWith('eq_fh_00') &&
          !e.id.startsWith('eq_hd_00')
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(cleaned));
        }
      }
    } catch (_) {}
  }

  // --- Departments Management ---
  getDepartments(): DepartmentItem[] {
    if (!this.isBrowser) return DEFAULT_DEPARTMENTS;
    const data = localStorage.getItem(STORAGE_KEYS.DEPARTMENTS);
    return data ? JSON.parse(data) : DEFAULT_DEPARTMENTS;
  }

  saveDepartments(departments: DepartmentItem[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(departments));
  }

  addDepartment(name: string): DepartmentItem {
    const list = this.getDepartments();
    const newItem: DepartmentItem = {
      id: `dept_${Date.now()}`,
      name: name.trim(),
      created_at: new Date().toISOString()
    };
    list.push(newItem);
    this.saveDepartments(list);
    return newItem;
  }

  updateDepartment(id: string, name: string): boolean {
    const list = this.getDepartments();
    const index = list.findIndex(d => d.id === id);
    if (index === -1) return false;
    list[index].name = name.trim();
    this.saveDepartments(list);
    return true;
  }

  deleteDepartment(id: string): boolean {
    const list = this.getDepartments();
    const filtered = list.filter(d => d.id !== id);
    if (filtered.length !== list.length) {
      this.saveDepartments(filtered);
      return true;
    }
    return false;
  }

  // --- Positions / Levels Management ---
  getPositions(): PositionItem[] {
    if (!this.isBrowser) return DEFAULT_POSITIONS;
    const data = localStorage.getItem(STORAGE_KEYS.POSITIONS);
    return data ? JSON.parse(data) : DEFAULT_POSITIONS;
  }

  savePositions(positions: PositionItem[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(positions));
  }

  addPosition(name: string, default_role: UserRole): PositionItem {
    const list = this.getPositions();
    const newItem: PositionItem = {
      id: `pos_${Date.now()}`,
      name: name.trim(),
      default_role,
      created_at: new Date().toISOString()
    };
    list.push(newItem);
    this.savePositions(list);
    return newItem;
  }

  updatePosition(id: string, name: string, default_role: UserRole): boolean {
    const list = this.getPositions();
    const index = list.findIndex(p => p.id === id);
    if (index === -1) return false;
    list[index].name = name.trim();
    list[index].default_role = default_role;
    this.savePositions(list);
    return true;
  }

  deletePosition(id: string): boolean {
    const list = this.getPositions();
    const filtered = list.filter(p => p.id !== id);
    if (filtered.length !== list.length) {
      this.savePositions(filtered);
      return true;
    }
    return false;
  }

  // --- Auth & Users ---
  getCurrentUser(): User | null {
    if (!this.isBrowser) return null;
    const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return u ? JSON.parse(u) : null;
  }

  setCurrentUser(user: User | null) {
    if (!this.isBrowser) return;
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  getUsers(): User[] {
    if (!this.isBrowser) return DEFAULT_USERS;
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : DEFAULT_USERS;
  }

  saveUsers(users: User[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  /**
   * Real Authentication: Verifies strictly against database password
   */
  verifyLogin(username: string, password: string): { user: User | null; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
      return { user: null, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' };
    }

    if (user.status === 'pending') {
      return { user: null, error: 'บัญชีของคุณอยู่ระหว่างรอแอดมินอนุมัติ' };
    }

    if (user.status === 'rejected') {
      return { user: null, error: 'บัญชีของคุณไม่ได้รับการอนุมัติการใช้งาน' };
    }

    // Strict real password check from database
    if (user.password !== password) {
      return { user: null, error: 'รหัสผ่านไม่ถูกต้อง' };
    }

    return { user };
  }

  // --- Equipment Management with Vacant Sequence Number Reuse ---
  getEquipment(type?: EquipmentType): Equipment[] {
    if (!this.isBrowser) return DEFAULT_EQUIPMENT;
    const data = localStorage.getItem(STORAGE_KEYS.EQUIPMENT);
    const list: Equipment[] = data ? JSON.parse(data) : DEFAULT_EQUIPMENT;
    
    // Attach calculated age
    const listWithAge = list.map(item => ({
      ...item,
      age: calculateEquipmentAge(item.in_service_date, item.latest_inspection_date)
    }));

    if (type) {
      return listWithAge.filter(e => e.type === type).sort((a, b) => a.sequence_number - b.sequence_number);
    }
    return listWithAge.sort((a, b) => a.sequence_number - b.sequence_number);
  }

  saveEquipment(equipment: Equipment[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(equipment));
  }

  /**
   * Add new equipment - automatically reuses the lowest vacant number
   */
  addEquipment(data: Omit<Equipment, 'id' | 'code' | 'sequence_number' | 'created_at' | 'updated_at'>): Equipment {
    const list = this.getEquipment();
    const type = data.type;

    // Find sequence numbers already in use for this equipment type
    const existingSeqs = list.filter(e => e.type === type).map(e => e.sequence_number);
    const vacantSeq = findLowestVacantNumber(existingSeqs);
    const code = formatEquipmentCode(type, vacantSeq);
    const now = new Date().toISOString();

    const newEquip: Equipment = {
      ...data,
      id: `eq_${type.toLowerCase()}_${Date.now()}`,
      code,
      sequence_number: vacantSeq,
      ready_status: data.ready_status || 'READY',
      inspection_status: 'PENDING',
      defect_status: 'NORMAL',
      created_at: now,
      updated_at: now,
      age: calculateEquipmentAge(data.in_service_date, undefined)
    };

    list.push(newEquip);
    this.saveEquipment(list);
    return newEquip;
  }

  updateEquipment(id: string, updates: Partial<Equipment>): Equipment | null {
    const list = this.getEquipment();
    const index = list.findIndex(e => e.id === id);
    if (index === -1) return null;

    const updated = {
      ...list[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    list[index] = updated;
    this.saveEquipment(list);
    return updated;
  }

  deleteEquipment(id: string): boolean {
    const list = this.getEquipment();
    const filtered = list.filter(e => e.id !== id);
    if (filtered.length !== list.length) {
      this.saveEquipment(filtered);
      return true;
    }
    return false;
  }

  // --- Inspections ---
  getInspections(): InspectionRecord[] {
    if (!this.isBrowser) return [];
    const data = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
    return data ? JSON.parse(data) : [];
  }

  saveInspections(inspections: InspectionRecord[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));
  }

  submitInspection(data: {
    equipment_id: string;
    inspector_id: string;
    inspector_name: string;
    ready_status: 'READY' | 'NOT_READY';
    checklist_results: Record<string, boolean>;
    inspection_photo?: string;
    location_photo?: string;
    is_abnormal: boolean;
    abnormal_description?: string;
    defect_resolved?: boolean;
    task_id?: string;
  }): { success: boolean; record: InspectionRecord } {
    const equipList = this.getEquipment();
    const equip = equipList.find(e => e.id === data.equipment_id);
    if (!equip) throw new Error('ไม่พบข้อมูลอุปกรณ์');

    const now = new Date().toISOString();
    const inspRecord: InspectionRecord = {
      id: `insp_${Date.now()}`,
      equipment_id: data.equipment_id,
      equipment_code: equip.code,
      equipment_type: equip.type,
      inspector_id: data.inspector_id,
      inspector_name: data.inspector_name,
      inspection_date: now,
      ready_status: data.is_abnormal ? 'NOT_READY' : data.ready_status,
      checklist_results: data.checklist_results,
      inspection_photo: data.inspection_photo,
      location_photo: data.location_photo,
      is_abnormal: data.is_abnormal,
      abnormal_description: data.abnormal_description,
      defect_resolved: !!data.defect_resolved,
      created_at: now
    };

    // Save inspection history
    const inspections = this.getInspections();
    inspections.unshift(inspRecord);
    this.saveInspections(inspections);

    // Update equipment state
    const defectStatus = data.is_abnormal ? 'DEFECT' : (data.defect_resolved ? 'RESOLVED' : 'NORMAL');
    this.updateEquipment(equip.id, {
      ready_status: inspRecord.ready_status,
      inspection_status: 'INSPECTED',
      latest_inspector: data.inspector_name,
      latest_inspection_date: now,
      defect_status: defectStatus,
      defect_notes: data.abnormal_description || (defectStatus === 'RESOLVED' ? 'ปัญหาได้รับการแก้ไขเรียบร้อยแล้ว' : equip.defect_notes),
      inspection_sheet_photo: data.inspection_photo || equip.inspection_sheet_photo,
      location_photo: data.location_photo || equip.location_photo
    });

    // If abnormal, send alert notification to P3 (Admin) and P4 (System Manager)
    if (data.is_abnormal) {
      this.sendNotification({
        recipient_user_id: null,
        target_role: 'P3',
        sender_name: data.inspector_name,
        title: 'แจ้งเตือนพบอุปกรณ์ชำรุด/ผิดปกติ',
        message: `อุปกรณ์ ${equip.code} (${equip.location}) พบปัญหา: ${data.abnormal_description || 'ไม่ระบุสาเหตุ'}`,
        type: 'DEFECT'
      });
    }

    // If this inspection was tied to a delegated task, mark task completed
    if (data.task_id) {
      this.updateTaskStatus(data.task_id, 'COMPLETED');
    }

    return { success: true, record: inspRecord };
  }

  resolveDefect(equipmentId: string, notes: string, resolverName: string): boolean {
    const updated = this.updateEquipment(equipmentId, {
      ready_status: 'READY',
      defect_status: 'RESOLVED',
      defect_notes: `แก้ไขเรียบร้อยโดย ${resolverName}: ${notes || 'ตรวจสอบและแก้ไขตามมาตรฐานแล้ว'}`
    });
    return !!updated;
  }

  // --- Tasks (Delegation & Activities) ---
  getTasks(userId?: string): Task[] {
    if (!this.isBrowser) return DEFAULT_TASKS;
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    const tasks: Task[] = data ? JSON.parse(data) : DEFAULT_TASKS;
    if (userId) {
      return tasks.filter(t => t.assigned_to_id === userId || t.assigned_by_id === userId);
    }
    return tasks;
  }

  saveTasks(tasks: Task[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'status'>): Task {
    const tasks = this.getTasks();
    const now = new Date().toISOString();
    const newTask: Task = {
      ...data,
      id: `tsk_${Date.now()}`,
      status: 'PENDING',
      created_at: now,
      updated_at: now
    };
    tasks.unshift(newTask);
    this.saveTasks(tasks);

    // Send personal notification to recipient
    this.sendNotification({
      recipient_user_id: data.assigned_to_id,
      target_role: undefined,
      sender_name: data.assigned_by_name,
      title: 'คุณได้รับมอบหมายงานใหม่',
      message: `${data.title} ${data.due_date ? `(กำหนดส่ง: ${data.due_date})` : ''}`,
      type: 'TASK'
    });

    return newTask;
  }

  updateTaskStatus(taskId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'): boolean {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    tasks[index].status = status;
    tasks[index].updated_at = new Date().toISOString();
    this.saveTasks(tasks);
    return true;
  }

  // --- Notifications ---
  getNotifications(userId?: string, role?: string): AppNotification[] {
    if (!this.isBrowser) return DEFAULT_NOTIFICATIONS;
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifs: AppNotification[] = data ? JSON.parse(data) : DEFAULT_NOTIFICATIONS;

    return notifs.filter(n => {
      // Direct recipient match
      if (userId && n.recipient_user_id === userId) return true;
      // Target role match or broadcast
      if (!n.recipient_user_id) {
        if (!n.target_role || n.target_role === 'ALL') return true;
        if (role && n.target_role === role) return true;
        if (role === 'P4') return true; // Super admin sees all
      }
      return false;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  sendNotification(data: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>): AppNotification {
    const notifs = this.getNotifications();
    const newNotif: AppNotification = {
      ...data,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      is_read: false,
      created_at: new Date().toISOString()
    };
    notifs.unshift(newNotif);
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    }
    return newNotif;
  }

  markNotificationAsRead(id: string) {
    if (!this.isBrowser) return;
    const notifs = this.getNotifications();
    const index = notifs.findIndex(n => n.id === id);
    if (index !== -1) {
      notifs[index].is_read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    }
  }

  // --- Password Reset Requests ---
  requestPasswordReset(username: string): boolean {
    const users = this.getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return false;

    const now = new Date().toISOString();
    this.sendNotification({
      recipient_user_id: null,
      target_role: 'P3',
      sender_name: username,
      title: 'คำขอรีเซ็ทรหัสผ่าน',
      message: `ผู้ใช้ ${username} (${user.department} - ${user.position}) ขอรีเซ็ทรหัสผ่าน กรุณาตรวจสอบและดำเนินการ`,
      type: 'PASSWORD_RESET'
    });
    return true;
  }
}

export const storageService = new StorageService();
