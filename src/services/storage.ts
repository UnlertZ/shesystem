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
  PositionItem,
  SafetyPatrolRound,
  SafetyFinding,
  PatrolStatus
} from '../types';
import {
  findLowestVacantNumber,
  formatEquipmentCode,
  calculateEquipmentAge
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
  CURRENT_USER: 'she_current_user_prod_v1',
  SAFETY_PATROLS: 'she_safety_patrols_prod_v1',
  SAFETY_FINDINGS: 'she_safety_findings_prod_v1'
};

// Initial Default Departments (แผนก)
const DEFAULT_DEPARTMENTS: DepartmentItem[] = [
  { id: 'dept_01', name: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'dept_02', name: 'แผนกผลิต (Production)', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'dept_03', name: 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'dept_04', name: 'แผนกซ่อมบำรุงและวิศวกรรม (Maintenance & Engineering)', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'dept_05', name: 'แผนกทรัพยากรบุคคลและธุรการ (HR & Admin)', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'dept_06', name: 'แผนกควบคุมคุณภาพ (QC & QA)', created_at: '2025-01-01T00:00:00+07:00' }
];

// Initial Default Positions / Levels (ระดับ / ตำแหน่ง)
const DEFAULT_POSITIONS: PositionItem[] = [
  { id: 'pos_01', name: 'พนักงาน', default_role: 'P1', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'pos_02', name: 'หัวหน้างาน', default_role: 'P2', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'pos_03', name: 'รองผู้จัดการ', default_role: 'P2', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'pos_04', name: 'ผู้จัดการ', default_role: 'P2', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'pos_05', name: 'เจ้าหน้าที่ความปลอดภัย (จป.)', default_role: 'P3', created_at: '2025-01-01T00:00:00+07:00' },
  { id: 'pos_06', name: 'ผู้จัดการระบบ (IT / Super Admin)', default_role: 'P4', created_at: '2025-01-01T00:00:00+07:00' }
];

// Initial Default Users with separated department & position, and real database passwords
export const DEFAULT_USERS: User[] = [
  {
    id: 'u_p4_opadmin',
    username: 'opadmin',
    full_name: 'ผู้จัดการระบบ โอพีแอดมิน',
    password: 'halls1999',
    department: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)',
    position: 'ผู้จัดการระบบ (IT / Super Admin)',
    role: 'P4',
    status: 'approved',
    is_safety_committee: true,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  },
  {
    id: 'u_p3_01',
    username: 'admin',
    full_name: 'สมบัติ ปลอดภัย (จป.วิชาชีพ)',
    password: 'admin123',
    department: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)',
    position: 'เจ้าหน้าที่ความปลอดภัย (จป.)',
    role: 'P3',
    status: 'approved',
    is_safety_committee: true,
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  },
  {
    id: 'u_p2_01',
    username: 'supervisor1',
    full_name: 'เกียรติศักดิ์ หัวหน้างาน',
    password: '123456',
    department: 'แผนกผลิต (Production)',
    position: 'หัวหน้างาน',
    role: 'P2',
    status: 'approved',
    is_safety_committee: false,
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  },
  {
    id: 'u_p1_01',
    username: 'staff1',
    full_name: 'สมชาย ใจดี',
    password: '123456',
    department: 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)',
    position: 'พนักงาน',
    role: 'P1',
    status: 'approved',
    is_safety_committee: false,
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    created_at: '2025-01-01T00:00:00+07:00'
  }
];

export function getUserDisplayName(user?: { full_name?: string; username: string } | null): string {
  if (!user) return '-';
  return user.full_name ? `${user.full_name} (${user.username})` : user.username;
}

// Initial Equipment - Clean Production Database (Starts empty)
const DEFAULT_EQUIPMENT: Equipment[] = [];

// Initial Tasks - Clean Production Database (Starts empty)
const DEFAULT_TASKS: Task[] = [];

// Initial Notifications - Clean Production Database (Starts empty)
const DEFAULT_NOTIFICATIONS: AppNotification[] = [];

/**
 * Upload an image file directly to Cloudflare R2 bucket: r2shesystem
 */
export async function uploadToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }
  } catch (err) {
    console.error('Upload to Cloudflare R2 error:', err);
  }
  // Fallback to base64 for seamless offline preview
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

class StorageService {
  private isBrowser = typeof window !== 'undefined';
  private syncInProgress = false;

  constructor() {
    this.initData();
    if (this.isBrowser) {
      // Trigger background sync with Cloudflare D1 immediately
      this.syncWithServer();
    }
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
    if (!localStorage.getItem(STORAGE_KEYS.SAFETY_PATROLS)) {
      localStorage.setItem(STORAGE_KEYS.SAFETY_PATROLS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SAFETY_FINDINGS)) {
      localStorage.setItem(STORAGE_KEYS.SAFETY_FINDINGS, JSON.stringify([]));
    }

    // Safety cleanup: If current storage has any legacy mock equipment IDs, remove them
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

    // Check if there is ANY user with role 'P4' in storage:
    // "ถ้าในdatabase ไม่มี user P4 เลย ให้เพิ่ม User opadmin password halls1999 ใน d1"
    try {
      const usersData = localStorage.getItem(STORAGE_KEYS.USERS);
      if (usersData) {
        const users: User[] = JSON.parse(usersData);
        const hasP4 = users.some(u => u.role === 'P4');
        const opadminIndex = users.findIndex(u => u.username.toLowerCase() === 'opadmin');
        if (!hasP4 || opadminIndex === -1) {
          const opadminUser: User = {
            id: 'u_p4_opadmin',
            username: 'opadmin',
            password: 'halls1999',
            department: 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)',
            position: 'ผู้จัดการระบบ (IT / Super Admin)',
            role: 'P4',
            status: 'approved',
            avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            created_at: '2025-01-01T00:00:00+07:00'
          };
          const cleanUsers = users.filter(u => u.username.toLowerCase() !== 'opadmin');
          cleanUsers.unshift(opadminUser);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cleanUsers));
        }
      }
    } catch (_) {}
  }

  /**
   * Synchronize all data with Cloudflare D1 Database
   */
  async syncWithServer(): Promise<void> {
    if (!this.isBrowser || this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      // 1. Fetch departments
      const deptRes = await fetch('/api/departments');
      if (deptRes.ok) {
        const data = await deptRes.json();
        if (Array.isArray(data.departments) && data.departments.length > 0) {
          localStorage.setItem(STORAGE_KEYS.DEPARTMENTS, JSON.stringify(data.departments));
        }
      }

      // 2. Fetch positions
      const posRes = await fetch('/api/positions');
      if (posRes.ok) {
        const data = await posRes.json();
        if (Array.isArray(data.positions) && data.positions.length > 0) {
          localStorage.setItem(STORAGE_KEYS.POSITIONS, JSON.stringify(data.positions));
        }
      }

      // 3. Fetch users
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (Array.isArray(data.users) && data.users.length > 0) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(data.users));
        }
      }

      // 4. Fetch equipment (D1 is the single source of truth)
      const equipRes = await fetch('/api/equipment');
      if (equipRes.ok) {
        const data = await equipRes.json();
        if (Array.isArray(data.equipment)) {
          localStorage.setItem(STORAGE_KEYS.EQUIPMENT, JSON.stringify(data.equipment));
        }
      }

      // 5. Fetch inspections
      const inspRes = await fetch('/api/inspections');
      if (inspRes.ok) {
        const data = await inspRes.json();
        if (Array.isArray(data.inspections)) {
          localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(data.inspections));
        }
      }

      // 6. Fetch tasks
      const taskRes = await fetch('/api/tasks');
      if (taskRes.ok) {
        const data = await taskRes.json();
        if (Array.isArray(data.tasks)) {
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(data.tasks));
        }
      }

      // 7. Fetch notifications
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const data = await notifRes.json();
        if (Array.isArray(data.notifications)) {
          localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data.notifications));
        }
      }

      // 8. Fetch safety committee patrols
      const patrolRes = await fetch('/api/safety-patrols');
      if (patrolRes.ok) {
        const data = await patrolRes.json();
        if (Array.isArray(data.patrols)) {
          localStorage.setItem(STORAGE_KEYS.SAFETY_PATROLS, JSON.stringify(data.patrols));
        }
      }

      // 9. Fetch safety committee findings
      const findRes = await fetch('/api/safety-findings');
      if (findRes.ok) {
        const data = await findRes.json();
        if (Array.isArray(data.findings)) {
          localStorage.setItem(STORAGE_KEYS.SAFETY_FINDINGS, JSON.stringify(data.findings));
        }
      }

      // Dispatch update event
      window.dispatchEvent(new CustomEvent('she_data_synced'));
    } catch (err) {
      console.warn('Sync with Cloudflare D1 warning (using cached data):', err);
    } finally {
      this.syncInProgress = false;
    }
  }

  // --- Departments Management (D1) ---
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

    // Sync to Cloudflare D1
    fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItem.name })
    }).catch(console.error);

    return newItem;
  }

  updateDepartment(id: string, name: string): boolean {
    const list = this.getDepartments();
    const index = list.findIndex(d => d.id === id);
    if (index === -1) return false;
    list[index].name = name.trim();
    this.saveDepartments(list);

    // Sync to Cloudflare D1
    fetch(`/api/departments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    }).catch(console.error);

    return true;
  }

  deleteDepartment(id: string): boolean {
    const list = this.getDepartments();
    const filtered = list.filter(d => d.id !== id);
    if (filtered.length !== list.length) {
      this.saveDepartments(filtered);

      // Sync to Cloudflare D1
      fetch(`/api/departments/${id}`, {
        method: 'DELETE'
      }).catch(console.error);

      return true;
    }
    return false;
  }

  // --- Positions / Levels Management (D1) ---
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

    // Sync to Cloudflare D1
    fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newItem.name, default_role })
    }).catch(console.error);

    return newItem;
  }

  updatePosition(id: string, name: string, default_role: UserRole): boolean {
    const list = this.getPositions();
    const index = list.findIndex(p => p.id === id);
    if (index === -1) return false;
    list[index].name = name.trim();
    list[index].default_role = default_role;
    this.savePositions(list);

    // Sync to Cloudflare D1
    fetch(`/api/positions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), default_role })
    }).catch(console.error);

    return true;
  }

  deletePosition(id: string): boolean {
    const list = this.getPositions();
    const filtered = list.filter(p => p.id !== id);
    if (filtered.length !== list.length) {
      this.savePositions(filtered);

      // Sync to Cloudflare D1
      fetch(`/api/positions/${id}`, {
        method: 'DELETE'
      }).catch(console.error);

      return true;
    }
    return false;
  }

  // --- Auth & Users (D1) ---
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

  /**
   * Async Login: queries Cloudflare D1 directly
   */
  async verifyLoginAsync(username: string, password: string): Promise<{ user: User | null; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { user: null, error: data.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
      }
      return { user: data.user };
    } catch (_) {
      // Fallback to local verified cache
      return this.verifyLogin(username, password);
    }
  }

  /**
   * Register new user directly into Cloudflare D1 with local fallback
   */
  async registerUser(data: { username: string; password: string; department: string; position: string; full_name?: string }): Promise<{ success: boolean; message: string }> {
    // 1. Ensure user is recorded immediately so it appears in Pending Approvals for P3/P4
    const users = this.getUsers();
    if (!users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) {
      const positions = this.getPositions();
      const matchedPos = positions.find(p => p.name === data.position);
      const role: UserRole = matchedPos ? matchedPos.default_role : 'P1';
      const now = new Date().toISOString();
      const newUser: User = {
        id: `u_${Date.now()}`,
        username: data.username.trim(),
        full_name: data.full_name?.trim() || undefined,
        password: data.password.trim(),
        department: data.department,
        position: data.position,
        role,
        status: 'pending',
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.full_name || data.username)}`,
        created_at: now
      };
      users.unshift(newUser);
      this.saveUsers(users);

      const displayName = data.full_name ? `${data.full_name} (${data.username})` : data.username;
      this.sendNotification({
        recipient_user_id: null,
        target_role: 'P3',
        sender_name: 'ระบบรับสมัครสมาชิก',
        title: 'มีสมาชิกรอการอนุมัติเข้าใช้งาน',
        message: `ผู้ใช้ ${displayName} แผนก: ${data.department} ตำแหน่ง: ${data.position} ได้ลงทะเบียนเข้าสู่ระบบ กรุณาตรวจสอบและอนุมัติ`,
        type: 'SYSTEM'
      });
    }

    // 2. Also send to Cloudflare D1
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        this.syncWithServer();
      }
    } catch (err) {
      console.warn('API register sync warning (saved locally):', err);
    }

    return { success: true, message: 'สมัครสมาชิกสำเร็จ รอแอดมินอนุมัติ' };
  }

  updateUser(id: string, updates: Partial<User>): boolean {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;

    users[index] = { ...users[index], ...updates, updated_at: new Date().toISOString() };
    this.saveUsers(users);

    fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(console.error);

    return true;
  }

  deleteUser(id: string): boolean {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length !== users.length) {
      this.saveUsers(filtered);
      fetch(`/api/users/${id}`, { method: 'DELETE' }).catch(console.error);
      return true;
    }
    return false;
  }

  approveUser(id: string, approved: boolean): boolean {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;

    users[index].status = approved ? 'approved' : 'rejected';
    this.saveUsers(users);

    fetch(`/api/users/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved })
    }).catch(console.error);

    return true;
  }

  resetPasswordToZero(id: string): boolean {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;

    users[index].password = '0000';
    this.saveUsers(users);

    fetch(`/api/users/${id}/reset-password`, {
      method: 'POST'
    }).catch(console.error);

    return true;
  }

  changeUserPassword(id: string, newPassword: string): boolean {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return false;

    users[index].password = newPassword;
    this.saveUsers(users);

    fetch(`/api/users/${id}/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    }).catch(console.error);

    return true;
  }

  // --- Equipment Management with Vacant Sequence Number Reuse (D1) ---
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
   * Add new equipment - automatically reuses the lowest vacant number and persists to D1
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

    // Save to Cloudflare D1 database
    fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.type,
        category: data.category,
        weight: data.weight,
        location: data.location,
        in_service_date: data.in_service_date,
        inspection_sheet_photo: data.inspection_sheet_photo,
        location_photo: data.location_photo,
        responsible_person: data.responsible_person
      })
    }).then(async res => {
      if (res.ok) {
        const resData = await res.json();
        if (resData.id && resData.id !== newEquip.id) {
          newEquip.id = resData.id;
          newEquip.code = resData.code;
          newEquip.sequence_number = resData.sequence_number;
          this.saveEquipment(this.getEquipment());
        }
      }
    }).catch(console.error);

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

    // Sync update to Cloudflare D1
    fetch(`/api/equipment/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(console.error);

    return updated;
  }

  deleteEquipment(id: string): boolean {
    const list = this.getEquipment();
    const filtered = list.filter(e => e.id !== id);
    if (filtered.length !== list.length) {
      this.saveEquipment(filtered);

      // Sync delete to Cloudflare D1
      fetch(`/api/equipment/${id}`, {
        method: 'DELETE'
      }).catch(console.error);

      return true;
    }
    return false;
  }

  /**
   * Bulk import equipment (for Excel import)
   */
  bulkAddEquipment(items: Array<Omit<Equipment, 'id' | 'code' | 'sequence_number' | 'created_at' | 'updated_at'>>): Equipment[] {
    const results: Equipment[] = [];
    for (const item of items) {
      const added = this.addEquipment(item);
      results.push(added);
    }
    return results;
  }

  // --- Inspections (D1) ---
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

    // Save inspection history locally
    const inspections = this.getInspections();
    inspections.unshift(inspRecord);
    this.saveInspections(inspections);

    // Update equipment state locally
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

    // Send inspection to Cloudflare D1
    fetch('/api/inspections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        equipment_code: equip.code
      })
    }).catch(console.error);

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

    // If this inspection was tied to a delegated task, mark task completed & notify assigner
    if (data.task_id) {
      this.updateTaskStatus(
        data.task_id,
        'COMPLETED',
        { id: data.inspector_id, name: data.inspector_name },
        'ตรวจเช็คอุปกรณ์ตามแบบฟอร์มเรียบร้อยแล้ว'
      );
    }

    return { success: true, record: inspRecord };
  }

  resolveDefect(equipmentId: string, notes: string, resolverName: string): boolean {
    const updated = this.updateEquipment(equipmentId, {
      ready_status: 'READY',
      defect_status: 'RESOLVED',
      defect_notes: `แก้ไขเรียบร้อยโดย ${resolverName}: ${notes || 'ตรวจสอบและแก้ไขตามมาตรฐานแล้ว'}`
    });

    fetch(`/api/equipment/${equipmentId}/resolve-defect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, resolver_name: resolverName })
    }).catch(console.error);

    return !!updated;
  }

  // --- Tasks (Delegation & Activities) (D1) ---
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

    // Send to Cloudflare D1
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(console.error);

    return newTask;
  }

  updateTaskStatus(
    taskId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
    completerUser?: User | { id?: string; name?: string; full_name?: string; username?: string } | null,
    notes?: string
  ): boolean {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    const task = tasks[index];
    task.status = status;
    task.updated_at = new Date().toISOString();

    let completerName = '';
    let completerId = '';
    if (completerUser) {
      completerId = ('id' in completerUser && completerUser.id) ? completerUser.id : '';
      if ('full_name' in completerUser && completerUser.full_name) {
        completerName = completerUser.full_name;
      } else if ('username' in completerUser && completerUser.username) {
        completerName = completerUser.username;
      } else if ('name' in completerUser && (completerUser as any).name) {
        completerName = (completerUser as any).name;
      }
    }
    if (!completerName) completerName = task.assigned_to_name || 'ผู้รับมอบหมาย';

    if (status === 'COMPLETED') {
      task.completed_at = new Date().toISOString();
      task.completed_by_id = completerId || task.assigned_to_id;
      task.completed_by_name = completerName;
      task.completion_notes = notes || '';

      // Send in-app notification to the person who assigned the task
      if (task.assigned_by_id) {
        const notesMsg = notes ? ` (บันทึก: ${notes})` : '';
        this.sendNotification({
          recipient_user_id: task.assigned_by_id,
          sender_name: completerName,
          title: 'งานที่มอบหมายดำเนินการเสร็จสิ้นแล้ว',
          message: `งาน "${task.title}" ได้รับการทำสำเร็จเรียบร้อยแล้ว โดย ${completerName}${notesMsg}`,
          type: 'TASK'
        });
      }
    } else {
      task.completed_at = undefined;
      task.completion_notes = undefined;
    }

    this.saveTasks(tasks);

    fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        completer_name: completerName,
        notes: notes || ''
      })
    }).catch(console.error);

    return true;
  }

  // --- Notifications (D1) ---
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

    fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(console.error);

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

    fetch(`/api/notifications/${id}/read`, {
      method: 'POST'
    }).catch(console.error);
  }

  /**
   * Clear all notifications for the user
   */
  clearNotifications(userId?: string) {
    if (!this.isBrowser) return;
    if (!userId) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const notifs: AppNotification[] = data ? JSON.parse(data) : [];
      // Keep notifications belonging to other specific users or broadcast
      const remaining = notifs.filter(n => n.recipient_user_id && n.recipient_user_id !== userId);
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(remaining));
    }

    fetch('/api/notifications/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    }).catch(console.error);
  }

  // --- Password Reset Requests ---
  requestPasswordReset(username: string): boolean {
    const users = this.getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return false;

    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    }).catch(console.error);

    return true;
  }

  // ==========================================
  // Safety Committee (คปอ.) Methods
  // ==========================================

  // Toggle user Safety Committee status (Requirement 3: P3/P4 can appoint / remove)
  toggleSafetyCommittee(userId: string, isCommittee: boolean, adminUser?: User | null): boolean {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;

    users[idx].is_safety_committee = isCommittee;
    this.saveUsers(users);

    // If current logged-in user is updated, sync session
    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      current.is_safety_committee = isCommittee;
      this.setCurrentUser(current);
    }

    const adminName = adminUser ? getUserDisplayName(adminUser) : 'แอดมิน';
    const notifTitle = isCommittee ? 'คุณได้รับการแต่งตั้งเป็นคณะกรรมการ คปอ.' : 'แจ้งปรับสถานะคณะกรรมการ คปอ.';
    const notifMessage = isCommittee
      ? `คุณได้รับการแต่งตั้งเป็น คณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน (คปอ.) โดย ${adminName}`
      : `คุณพ้นจากสถานะ คณะกรรมการความปลอดภัย (คปอ.) เรียบร้อยแล้ว`;

    this.sendNotification({
      recipient_user_id: userId,
      sender_name: adminName,
      title: notifTitle,
      message: notifMessage,
      type: 'SYSTEM'
    });

    // Sync to Cloudflare D1
    fetch(`/api/users/${userId}/safety-committee`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_safety_committee: isCommittee,
        admin_name: adminName
      })
    }).catch(console.error);

    return true;
  }

  // --- Safety Patrol Rounds (Requirement 5 & 7) ---
  getSafetyPatrols(): SafetyPatrolRound[] {
    if (!this.isBrowser) return [];
    const data = localStorage.getItem(STORAGE_KEYS.SAFETY_PATROLS);
    const patrols: SafetyPatrolRound[] = data ? JSON.parse(data) : [];
    const findings = this.getSafetyFindings();

    // Map findings_count
    return patrols.map(p => ({
      ...p,
      findings_count: findings.filter(f => f.patrol_id === p.id).length
    })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  saveSafetyPatrols(patrols: SafetyPatrolRound[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.SAFETY_PATROLS, JSON.stringify(patrols));
  }

  createSafetyPatrol(patrolData: Omit<SafetyPatrolRound, 'id' | 'created_at' | 'findings_count'>): SafetyPatrolRound {
    const list = this.getSafetyPatrols();
    const now = new Date().toISOString();
    const newPatrol: SafetyPatrolRound = {
      ...patrolData,
      id: `patrol_${Date.now()}`,
      created_at: now,
      findings_count: 0
    };

    list.unshift(newPatrol);
    this.saveSafetyPatrols(list);

    // Broadcast notification to all users about new patrol round
    this.sendNotification({
      target_role: 'ALL',
      sender_name: patrolData.created_by_name || 'แอดมิน คปอ.',
      title: 'เปิดรอบเดินตรวจ คปอ. ใหม่',
      message: `มีรายการเดินตรวจ คปอ. ประจำวันที่ ${patrolData.patrol_date} (${patrolData.time_range}) สมาชิก คปอ. สามารถกดเข้าร่วมบันทึกข้อมูลได้แล้ว`,
      type: 'SYSTEM'
    });

    // Sync to Cloudflare D1
    fetch('/api/safety-patrols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPatrol)
    }).catch(console.error);

    return newPatrol;
  }

  // Toggle Open/Close patrol round (Requirement 7)
  togglePatrolStatus(id: string, status: PatrolStatus): boolean {
    const list = this.getSafetyPatrols();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return false;

    list[idx].status = status;
    list[idx].updated_at = new Date().toISOString();
    this.saveSafetyPatrols(list);

    // Sync to Cloudflare D1
    fetch(`/api/safety-patrols/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).catch(console.error);

    return true;
  }

  deleteSafetyPatrol(id: string): boolean {
    const list = this.getSafetyPatrols();
    const filtered = list.filter(p => p.id !== id);
    if (filtered.length !== list.length) {
      this.saveSafetyPatrols(filtered);

      // Also clean up findings associated with this patrol
      const findings = this.getSafetyFindings();
      const remFindings = findings.filter(f => f.patrol_id !== id);
      this.saveSafetyFindings(remFindings);

      fetch(`/api/safety-patrols/${id}`, { method: 'DELETE' }).catch(console.error);
      return true;
    }
    return false;
  }

  // --- Safety Findings (Requirement 6 & 8) ---
  getSafetyFindings(patrolId?: string): SafetyFinding[] {
    if (!this.isBrowser) return [];
    const data = localStorage.getItem(STORAGE_KEYS.SAFETY_FINDINGS);
    const findings: SafetyFinding[] = data ? JSON.parse(data) : [];
    if (patrolId) {
      return findings.filter(f => f.patrol_id === patrolId);
    }
    return findings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  saveSafetyFindings(findings: SafetyFinding[]) {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.SAFETY_FINDINGS, JSON.stringify(findings));
  }

  createSafetyFinding(findingData: Omit<SafetyFinding, 'id' | 'created_at' | 'status'>): SafetyFinding {
    const list = this.getSafetyFindings();
    const now = new Date().toISOString();
    const isRecommend = findingData.category === 'RECOMMEND';
    const initialStatus = isRecommend ? 'PENDING_ACTION' : 'COMMENDED';

    const newFinding: SafetyFinding = {
      ...findingData,
      id: `find_${Date.now()}`,
      status: initialStatus,
      created_at: now
    };

    list.unshift(newFinding);
    this.saveSafetyFindings(list);

    // If recommendation/hazard, alert SHE Admins
    if (isRecommend) {
      this.sendNotification({
        target_role: 'P3',
        sender_name: findingData.reporter_name,
        title: 'มีการบันทึกจุดเสี่ยง/ข้อแนะนำใหม่จาก คปอ.',
        message: `สมาชิก คปอ. (${findingData.reporter_name}) ได้บันทึกข้อแนะนำ/จุดเสี่ยง บริเวณ: ${findingData.location}`,
        type: 'ALERT'
      });
    }

    // Sync to Cloudflare D1
    fetch('/api/safety-findings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFinding)
    }).catch(console.error);

    return newFinding;
  }

  // Submit Before & After resolution (Requirement 8)
  resolveSafetyFinding(id: string, afterPhoto: string, actionTaken: string, resolver: User): boolean {
    const list = this.getSafetyFindings();
    const idx = list.findIndex(f => f.id === id);
    if (idx === -1) return false;

    const now = new Date().toISOString();
    const resolverName = getUserDisplayName(resolver);

    list[idx] = {
      ...list[idx],
      after_photo_url: afterPhoto,
      action_taken: actionTaken,
      resolved_by_id: resolver.id,
      resolved_by_name: resolverName,
      resolved_at: now,
      status: 'PENDING_REVIEW',
      reject_reason: undefined,
      updated_at: now
    };

    this.saveSafetyFindings(list);

    // Notify Admins for inspection
    this.sendNotification({
      target_role: 'P3',
      sender_name: resolverName,
      title: 'มีการส่งผลแก้ไขปัญหา (Before/After) รอตรวจสอบ',
      message: `รายการที่ "${list[idx].location}" ได้รับการแก้ไขแล้วโดย ${resolverName} กรุณาเข้าตรวจสอบผลงาน`,
      type: 'TASK'
    });

    // Sync to Cloudflare D1
    fetch(`/api/safety-findings/${id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        after_photo_url: afterPhoto,
        action_taken: actionTaken,
        resolved_by_id: resolver.id,
        resolved_by_name: resolverName,
        location: list[idx].location
      })
    }).catch(console.error);

    return true;
  }

  // Admin Review: Approve or Reject / Send back to fix again (Requirement 8)
  reviewSafetyFinding(id: string, approved: boolean, reviewer: User, rejectReason?: string): boolean {
    const list = this.getSafetyFindings();
    const idx = list.findIndex(f => f.id === id);
    if (idx === -1) return false;

    const finding = list[idx];
    const now = new Date().toISOString();
    const reviewerName = getUserDisplayName(reviewer);
    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    list[idx] = {
      ...finding,
      status: newStatus,
      reviewed_by_id: reviewer.id,
      reviewed_by_name: reviewerName,
      reviewed_at: now,
      reject_reason: approved ? undefined : (rejectReason || 'ต้องดำเนินการแก้ไขเพิ่มเติม'),
      updated_at: now
    };

    this.saveSafetyFindings(list);

    // Requirement 8: If rejected (แก้ใหม่), send notification to user who resolved it!
    const targetUserId = finding.resolved_by_id || finding.reporter_id;
    if (targetUserId) {
      const notifTitle = approved ? 'การแก้ไขปัญหาผ่านการตรวจสอบแล้ว' : 'ผลการแก้ไขไม่ผ่าน (ส่งกลับไปแก้ใหม่)';
      const notifMsg = approved
        ? `รายการที่ "${finding.location}" ผ่านการตรวจสอบจากแอดมิน (${reviewerName}) บันทึกผลสำเร็จเรียบร้อยแล้ว`
        : `รายการที่ "${finding.location}" ไม่ผ่านการตรวจสอบ: "${rejectReason || 'กรุณาแก้ไขเพิ่มเติม'}" กรุณาดำเนินการแก้ไขและส่งรูปภาพผลการแก้ไขใหม่อีกครั้ง`;

      this.sendNotification({
        recipient_user_id: targetUserId,
        sender_name: reviewerName,
        title: notifTitle,
        message: notifMsg,
        type: approved ? 'SYSTEM' : 'ALERT'
      });
    }

    // Sync to Cloudflare D1
    fetch(`/api/safety-findings/${id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved,
        reviewer_id: reviewer.id,
        reviewer_name: reviewerName,
        reject_reason: rejectReason
      })
    }).catch(console.error);

    return true;
  }
}

export const storageService = new StorageService();
