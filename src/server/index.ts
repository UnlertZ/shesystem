import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

let isDbInitialized = false;

async function ensureDbInitialized(db: D1Database) {
  if (isDbInitialized) return;

  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS positions (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          default_role TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT DEFAULT '',
          department TEXT NOT NULL,
          position TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          avatar_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS equipment (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          sequence_number INTEGER NOT NULL,
          category TEXT,
          weight TEXT,
          location TEXT NOT NULL,
          in_service_date TEXT,
          inspection_sheet_photo TEXT,
          location_photo TEXT,
          ready_status TEXT NOT NULL DEFAULT 'READY',
          inspection_status TEXT NOT NULL DEFAULT 'PENDING',
          responsible_person TEXT NOT NULL,
          latest_inspector TEXT,
          latest_inspection_date TEXT,
          defect_status TEXT NOT NULL DEFAULT 'NORMAL',
          defect_notes TEXT,
          defect_photo TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS inspections (
          id TEXT PRIMARY KEY,
          equipment_id TEXT NOT NULL,
          inspector_id TEXT NOT NULL,
          inspector_name TEXT NOT NULL,
          inspection_date TEXT NOT NULL,
          ready_status TEXT NOT NULL,
          checklist_results TEXT NOT NULL,
          inspection_photo TEXT,
          location_photo TEXT,
          is_abnormal INTEGER NOT NULL DEFAULT 0,
          abnormal_description TEXT,
          defect_resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at TEXT,
          resolved_by TEXT,
          created_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          equipment_id TEXT,
          assigned_by_id TEXT NOT NULL,
          assigned_by_name TEXT NOT NULL,
          assigned_to_id TEXT NOT NULL,
          assigned_to_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          task_type TEXT NOT NULL DEFAULT 'INSPECTION',
          due_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          recipient_user_id TEXT,
          target_role TEXT,
          sender_name TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          requested_at TEXT NOT NULL
        )
      `)
    ]);

    try {
      await db.prepare('ALTER TABLE users ADD COLUMN full_name TEXT').run();
    } catch (_) {}

    // Seed default departments if table is empty
    const deptCheck = await db.prepare('SELECT COUNT(*) as count FROM departments').first<{ count: number }>();
    if (!deptCheck || deptCheck.count === 0) {
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO departments (id, name, created_at) VALUES ('dept_01', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO departments (id, name, created_at) VALUES ('dept_02', 'แผนกผลิต (Production)', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO departments (id, name, created_at) VALUES ('dept_03', 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO departments (id, name, created_at) VALUES ('dept_04', 'แผนกซ่อมบำรุงและวิศวกรรม (Maintenance & Engineering)', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO departments (id, name, created_at) VALUES ('dept_05', 'แผนกทรัพยากรบุคคลและธุรการ (HR & Admin)', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO departments (id, name, created_at) VALUES ('dept_06', 'แผนกควบคุมคุณภาพ (QC & QA)', '2025-01-01T00:00:00+07:00')`)
      ]);
    }

    // Seed default positions if table is empty
    const posCheck = await db.prepare('SELECT COUNT(*) as count FROM positions').first<{ count: number }>();
    if (!posCheck || posCheck.count === 0) {
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES ('pos_01', 'พนักงาน', 'P1', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES ('pos_02', 'หัวหน้างาน', 'P2', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES ('pos_03', 'รองผู้จัดการ', 'P2', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES ('pos_04', 'ผู้จัดการ', 'P2', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES ('pos_05', 'เจ้าหน้าที่ความปลอดภัย (จป.)', 'P3', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES ('pos_06', 'ผู้จัดการระบบ (IT / Super Admin)', 'P4', '2025-01-01T00:00:00+07:00')`)
      ]);
    }

    // Seed initial users if table is empty
    const userCheck = await db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    if (!userCheck || userCheck.count === 0) {
      await db.batch([
        db.prepare(`INSERT OR IGNORE INTO users (id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at) VALUES ('u_p4_opadmin', 'opadmin', 'halls1999', 'ผู้จัดการระบบ โอพีแอดมิน', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', 'ผู้จัดการระบบ (IT / Super Admin)', 'P4', 'approved', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO users (id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at) VALUES ('u_p3_01', 'admin', 'admin123', 'สมบัติ ปลอดภัย (จป.วิชาชีพ)', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', 'เจ้าหน้าที่ความปลอดภัย (จป.)', 'P3', 'approved', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO users (id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at) VALUES ('u_p2_01', 'supervisor1', '123456', 'เกียรติศักดิ์ หัวหน้างาน', 'แผนกผลิต (Production)', 'หัวหน้างาน', 'P2', 'approved', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00')`),
        db.prepare(`INSERT OR IGNORE INTO users (id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at) VALUES ('u_p1_01', 'staff1', '123456', 'สมชาย ใจดี', 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', 'พนักงาน', 'P1', 'approved', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00')`)
      ]);
    }

    // Ensure opadmin with password halls1999 and role P4 exists
    // "ให้เพิ่ม User opadmin password halls1999 ใน d1 ถ้าในdatabase ไม่มี user P4 เลย"
    const p4Count = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'P4'").first<{ count: number }>();
    const opadminUser = await db.prepare("SELECT id FROM users WHERE username = 'opadmin'").first();

    if (!p4Count || p4Count.count === 0 || !opadminUser) {
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT OR REPLACE INTO users (id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at)
        VALUES ('u_p4_opadmin', 'opadmin', 'halls1999', 'ผู้จัดการระบบ โอพีแอดมิน', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', 'ผู้จัดการระบบ (IT / Super Admin)', 'P4', 'approved', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', ?, ?)
      `).bind(now, now).run();
      // Clean up legacy superadmin
      await db.prepare("DELETE FROM users WHERE username = 'superadmin'").run();
    }

    isDbInitialized = true;
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Auto-run DB init on all /api routes
app.use('/api/*', async (c, next) => {
  if (c.env?.DB) {
    await ensureDbInitialized(c.env.DB);
  }
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'shesystem', database: 'd1shesystem', storage: 'r2shesystem' });
});

// ==========================================
// 1. Departments Management Endpoints (D1)
// ==========================================
app.get('/api/departments', async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT id, name, created_at FROM departments ORDER BY created_at ASC').all();
  return c.json({ departments: results });
});

app.post('/api/departments', async (c) => {
  const { name } = await c.req.json();
  const db = c.env.DB;
  if (!name || !name.trim()) {
    return c.json({ error: 'กรุณากรอกชื่อแผนก' }, 400);
  }
  const id = `dept_${Date.now()}`;
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO departments (id, name, created_at) VALUES (?, ?, ?)').bind(id, name.trim(), now).run();
  return c.json({ success: true, department: { id, name: name.trim(), created_at: now } });
});

app.put('/api/departments/:id', async (c) => {
  const id = c.req.param('id');
  const { name } = await c.req.json();
  const db = c.env.DB;
  if (!name || !name.trim()) {
    return c.json({ error: 'กรุณากรอกชื่อแผนก' }, 400);
  }
  await db.prepare('UPDATE departments SET name = ? WHERE id = ?').bind(name.trim(), id).run();
  return c.json({ success: true });
});

app.delete('/api/departments/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM departments WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==========================================
// 2. Positions Management Endpoints (D1)
// ==========================================
app.get('/api/positions', async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT id, name, default_role, created_at FROM positions ORDER BY created_at ASC').all();
  return c.json({ positions: results });
});

app.post('/api/positions', async (c) => {
  const { name, default_role } = await c.req.json();
  const db = c.env.DB;
  if (!name || !name.trim()) {
    return c.json({ error: 'กรุณากรอกชื่อระดับ / ตำแหน่ง' }, 400);
  }
  const id = `pos_${Date.now()}`;
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO positions (id, name, default_role, created_at) VALUES (?, ?, ?, ?)').bind(id, name.trim(), default_role || 'P1', now).run();
  return c.json({ success: true, position: { id, name: name.trim(), default_role: default_role || 'P1', created_at: now } });
});

app.put('/api/positions/:id', async (c) => {
  const id = c.req.param('id');
  const { name, default_role } = await c.req.json();
  const db = c.env.DB;
  if (!name || !name.trim()) {
    return c.json({ error: 'กรุณากรอกชื่อระดับ / ตำแหน่ง' }, 400);
  }
  await db.prepare('UPDATE positions SET name = ?, default_role = ? WHERE id = ?').bind(name.trim(), default_role || 'P1', id).run();
  return c.json({ success: true });
});

app.delete('/api/positions/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM positions WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==========================================
// 3. Authentication & Users (D1)
// ==========================================
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  const db = c.env.DB;
  
  const user = await db.prepare(
    'SELECT * FROM users WHERE username = ?'
  ).bind(username).first<any>();

  if (!user) {
    return c.json({ error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' }, 404);
  }

  if (user.password !== password) {
    return c.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
  }

  if (user.status === 'pending') {
    return c.json({ error: 'บัญชีของคุณอยู่ระหว่างรอแอดมินอนุมัติ' }, 403);
  }

  if (user.status === 'rejected') {
    return c.json({ error: 'บัญชีของคุณไม่ได้รับการอนุมัติการใช้งาน' }, 403);
  }

  return c.json({ user });
});

app.post('/api/auth/register', async (c) => {
  const { username, password, full_name, department, position } = await c.req.json();
  const db = c.env.DB;

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) {
    return c.json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' }, 400);
  }

  // Determine role from position
  let role = 'P1';
  if (position) {
    const pos = await db.prepare('SELECT default_role FROM positions WHERE name = ?').bind(position).first<any>();
    if (pos) {
      role = pos.default_role;
    } else if (position.includes('หัวหน้า') || position.includes('ผู้จัดการ')) {
      role = 'P2';
    }
  } else if (department === 'พนักงาน') {
    role = 'P1';
  } else {
    role = 'P2';
  }

  const id = 'u_' + Date.now();
  const now = new Date().toISOString();
  const displayName = (full_name && full_name.trim()) ? full_name.trim() : username.trim();

  await db.prepare(
    'INSERT INTO users (id, username, password, full_name, department, position, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, username.trim(), password, displayName, department || '', position || '', role, 'pending', now, now).run();

  // Notify admin of new registration
  const notifId = 'notif_' + Date.now();
  await db.prepare(
    'INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(notifId, null, 'P3', 'ระบบสมัครสมาชิก', 'มีสมาชิกรอการอนุมัติ', `ผู้ใช้ ${displayName} (${username.trim()} - ${department || ''} - ${position || ''}) สมัครสมาชิกเข้าสู่ระบบ รอการอนุมัติ`, 'SYSTEM', 0, now).run();

  return c.json({ success: true, message: 'สมัครสมาชิกสำเร็จ รอแอดมินอนุมัติ' });
});

app.post('/api/auth/forgot-password', async (c) => {
  const { username } = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  const user = await db.prepare('SELECT id, department FROM users WHERE username = ?').bind(username).first();
  if (!user) {
    return c.json({ error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' }, 404);
  }

  const resetId = 'rst_' + Date.now();
  await db.prepare(
    'INSERT INTO password_resets (id, username, status, requested_at) VALUES (?, ?, ?, ?)'
  ).bind(resetId, username, 'PENDING', now).run();

  // Send alert to admin
  const notifId = 'notif_' + Date.now();
  await db.prepare(
    'INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(notifId, null, 'P3', username, 'คำขอรีเซ็ทรหัสผ่าน', `ผู้ใช้ ${username} ขอรีเซ็ทรหัสผ่าน กรุณาตรวจสอบและดำเนินการ`, 'PASSWORD_RESET', 0, now).run();

  return c.json({ success: true, message: 'ส่งคำขอรีเซ็ทรหัสผ่านไปยังแอดมินเรียบร้อยแล้ว' });
});

// ==========================================
// 4. User Management Endpoints (D1)
// ==========================================
app.get('/api/users', async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at FROM users ORDER BY created_at DESC').all();
  return c.json({ users: results });
});

app.post('/api/users', async (c) => {
  const data = await c.req.json();
  const db = c.env.DB;
  const id = `u_${Date.now()}`;
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO users (id, username, password, full_name, department, position, role, status, avatar_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)
  `).bind(
    id, data.username, data.password || '123456', data.full_name || data.username, data.department || '',
    data.position || '', data.role || 'P1', data.avatar_url || '', now, now
  ).run();

  return c.json({ success: true, id });
});

app.put('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE users SET
      full_name = COALESCE(?, full_name),
      department = COALESCE(?, department),
      position = COALESCE(?, position),
      role = COALESCE(?, role),
      status = COALESCE(?, status),
      password = COALESCE(?, password),
      avatar_url = COALESCE(?, avatar_url),
      updated_at = ?
    WHERE id = ?
  `).bind(
    data.full_name || null, data.department || null, data.position || null, data.role || null,
    data.status || null, data.password || null, data.avatar_url || null, now, id
  ).run();

  return c.json({ success: true });
});

app.post('/api/users/:id/approve', async (c) => {
  const id = c.req.param('id');
  const { approved } = await c.req.json();
  const db = c.env.DB;
  const status = approved ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  await db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();

  // Send notification to the user
  const notifId = 'notif_' + Date.now();
  await db.prepare(`
    INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    notifId, id, null, 'แอดมิน',
    approved ? 'บัญชีของคุณได้รับการอนุมัติแล้ว' : 'บัญชีของคุณไม่ได้รับการอนุมัติ',
    approved ? 'คุณสามารถเข้าสู่ระบบและเริ่มใช้งาน SHE System ได้ทันที' : 'ขออภัย บัญชีของคุณไม่ได้รับการอนุมัติการใช้งาน',
    'SYSTEM', 0, now
  ).run();

  return c.json({ success: true, status });
});

app.post('/api/users/:id/reset-password', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').bind('0000', now, id).run();
  return c.json({ success: true, message: 'รีเซ็ทรหัสผ่านเป็น 0000 เรียบร้อยแล้ว' });
});

app.post('/api/users/:id/change-password', async (c) => {
  const id = c.req.param('id');
  const { newPassword } = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').bind(newPassword, now, id).run();
  return c.json({ success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
});

app.delete('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==========================================
// 5. Equipment Management Endpoints (D1)
// Vacant sequence number reuse per equipment type
// ==========================================
app.get('/api/equipment', async (c) => {
  const db = c.env.DB;
  const type = c.req.query('type');
  let query = 'SELECT * FROM equipment';
  const params: any[] = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY sequence_number ASC';
  const { results } = await db.prepare(query).bind(...params).all();
  return c.json({ equipment: results });
});

app.post('/api/equipment', async (c) => {
  const data = await c.req.json();
  const db = c.env.DB;
  const type = data.type || 'EX';

  // Calculate lowest vacant sequence number
  const { results: existing } = await db.prepare(
    'SELECT sequence_number FROM equipment WHERE type = ? ORDER BY sequence_number ASC'
  ).bind(type).all();

  const seqs = new Set(existing.map((e: any) => Number(e.sequence_number)));
  let vacantSeq = 1;
  while (seqs.has(vacantSeq)) {
    vacantSeq++;
  }

  const code = `${type}-${String(vacantSeq).padStart(3, '0')}`;
  const id = `eq_${type.toLowerCase()}_${Date.now()}`;
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO equipment (
      id, type, code, sequence_number, category, weight, location, in_service_date,
      inspection_sheet_photo, location_photo, ready_status, inspection_status,
      responsible_person, defect_status, defect_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, type, code, vacantSeq, data.category || '', data.weight || '', data.location,
    data.in_service_date || '', data.inspection_sheet_photo || '', data.location_photo || '',
    'READY', 'PENDING', data.responsible_person || '', 'NORMAL', '', now, now
  ).run();

  return c.json({ success: true, id, code, sequence_number: vacantSeq });
});

app.put('/api/equipment/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE equipment SET
      category = ?, weight = ?, location = ?, in_service_date = ?,
      inspection_sheet_photo = COALESCE(?, inspection_sheet_photo),
      location_photo = COALESCE(?, location_photo),
      responsible_person = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    data.category, data.weight, data.location, data.in_service_date,
    data.inspection_sheet_photo || null, data.location_photo || null,
    data.responsible_person, now, id
  ).run();

  return c.json({ success: true });
});

app.delete('/api/equipment/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM equipment WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'ลบอุปกรณ์เรียบร้อยแล้ว เลขรหัสจะถูกนำกลับมาใช้ใหม่อัตโนมัติ' });
});

// Resolve Defect
app.post('/api/equipment/:id/resolve-defect', async (c) => {
  const id = c.req.param('id');
  const { notes, resolver_name } = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE equipment SET
      ready_status = 'READY',
      defect_status = 'RESOLVED',
      defect_notes = ?,
      updated_at = ?
    WHERE id = ?
  `).bind(`แก้ไขเรียบร้อยโดย ${resolver_name}: ${notes || 'ตรวจสอบและแก้ไขตามมาตรฐานแล้ว'}`, now, id).run();

  return c.json({ success: true });
});

// ==========================================
// 6. Inspection Submission & History (D1)
// ==========================================
app.get('/api/inspections', async (c) => {
  const db = c.env.DB;
  const equipmentId = c.req.query('equipmentId');
  let query = 'SELECT * FROM inspections';
  const params: any[] = [];
  if (equipmentId) {
    query += ' WHERE equipment_id = ?';
    params.push(equipmentId);
  }
  query += ' ORDER BY inspection_date DESC';
  const { results } = await db.prepare(query).bind(...params).all();
  return c.json({ inspections: results });
});

app.post('/api/inspections', async (c) => {
  const data = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();
  const inspId = 'insp_' + Date.now();

  const isAbnormal = data.is_abnormal ? 1 : 0;
  const readyStatus = isAbnormal ? 'NOT_READY' : (data.ready_status || 'READY');
  const defectStatus = isAbnormal ? 'DEFECT' : (data.defect_resolved ? 'RESOLVED' : 'NORMAL');

  // Insert inspection record
  await db.prepare(`
    INSERT INTO inspections (
      id, equipment_id, inspector_id, inspector_name, inspection_date,
      ready_status, checklist_results, inspection_photo, location_photo,
      is_abnormal, abnormal_description, defect_resolved, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    inspId, data.equipment_id, data.inspector_id, data.inspector_name,
    now, readyStatus, typeof data.checklist_results === 'string' ? data.checklist_results : JSON.stringify(data.checklist_results || {}),
    data.inspection_photo || '', data.location_photo || '',
    isAbnormal, data.abnormal_description || '', data.defect_resolved ? 1 : 0, now
  ).run();

  // Update equipment status
  await db.prepare(`
    UPDATE equipment SET
      ready_status = ?,
      inspection_status = 'INSPECTED',
      latest_inspector = ?,
      latest_inspection_date = ?,
      defect_status = ?,
      defect_notes = ?,
      defect_photo = COALESCE(?, defect_photo),
      updated_at = ?
    WHERE id = ?
  `).bind(
    readyStatus, data.inspector_name, now, defectStatus,
    data.abnormal_description || (defectStatus === 'RESOLVED' ? 'ปัญหาได้รับการแก้ไขเรียบร้อยแล้ว' : ''),
    data.inspection_photo || null, now, data.equipment_id
  ).run();

  // If abnormal, notify admin (P3, P4)
  if (isAbnormal) {
    const notifId = 'notif_' + Date.now();
    await db.prepare(`
      INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      notifId, null, 'P3', data.inspector_name,
      'แจ้งเตือนพบอุปกรณ์ชำรุด/ผิดปกติ',
      `อุปกรณ์ ${data.equipment_code || data.equipment_id} พบปัญหา: ${data.abnormal_description}`,
      'DEFECT', 0, now
    ).run();
  }

  // If this inspection was part of an assigned task, mark task as completed
  if (data.task_id) {
    await db.prepare(`
      UPDATE tasks SET status = 'COMPLETED', updated_at = ? WHERE id = ?
    `).bind(now, data.task_id).run();
  }

  return c.json({ success: true, inspection_id: inspId });
});

// ==========================================
// 7. Cloudflare R2 Upload & Serve Endpoints
// Bucket: r2shesystem
// ==========================================
app.post('/api/upload', async (c) => {
  const r2 = c.env.R2;
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'ไม่พบไฟล์รูปภาพที่อัปโหลด' }, 400);
  }

  const fileKey = `photos/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const arrayBuffer = await file.arrayBuffer();

  await r2.put(fileKey, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || 'image/jpeg'
    }
  });

  return c.json({ success: true, key: fileKey, url: `/api/images/${fileKey}` });
});

app.get('/api/images/*', async (c) => {
  const r2 = c.env.R2;
  const key = c.req.path.replace('/api/images/', '');
  const object = await r2.get(key);

  if (!object) {
    return c.text('Image Not Found', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000');
  return new Response(object.body, { headers });
});

// ==========================================
// 8. Tasks Management (D1)
// ==========================================
app.get('/api/tasks', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('userId');
  let query = 'SELECT * FROM tasks';
  const params: any[] = [];
  if (userId) {
    query += ' WHERE assigned_to_id = ? OR assigned_by_id = ?';
    params.push(userId, userId);
  }
  query += ' ORDER BY created_at DESC';
  const { results } = await db.prepare(query).bind(...params).all();
  return c.json({ tasks: results });
});

app.post('/api/tasks', async (c) => {
  const data = await c.req.json();
  const db = c.env.DB;
  const id = 'tsk_' + Date.now();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO tasks (
      id, title, description, equipment_id, assigned_by_id, assigned_by_name,
      assigned_to_id, assigned_to_name, status, task_type, due_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, data.title, data.description || '', data.equipment_id || null,
    data.assigned_by_id, data.assigned_by_name, data.assigned_to_id,
    data.assigned_to_name, 'PENDING', data.task_type || 'INSPECTION',
    data.due_date || '', now, now
  ).run();

  // Send personal notification to assigned user
  const notifId = 'notif_' + Date.now();
  await db.prepare(`
    INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    notifId, data.assigned_to_id, null, data.assigned_by_name,
    'คุณได้รับมอบหมายงานใหม่',
    `ได้รับมอบหมายงาน: ${data.title} กำหนดส่ง: ${data.due_date || 'เร็วที่สุด'}`,
    'TASK', 0, now
  ).run();

  return c.json({ success: true, id });
});

app.patch('/api/tasks/:id/status', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();
  return c.json({ success: true });
});

app.delete('/api/tasks/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ==========================================
// 9. Notifications (D1)
// ==========================================
app.get('/api/notifications', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('userId');
  const role = c.req.query('role');

  const { results } = await db.prepare(`
    SELECT * FROM notifications
    WHERE (recipient_user_id = ? OR recipient_user_id IS NULL)
      AND (target_role IS NULL OR target_role = 'ALL' OR target_role = ?)
    ORDER BY created_at DESC LIMIT 50
  `).bind(userId || '', role || '').all();

  return c.json({ notifications: results });
});

app.post('/api/notifications/send', async (c) => {
  const { recipient_user_id, target_role, sender_name, title, message, type } = await c.req.json();
  const db = c.env.DB;
  const id = 'notif_' + Date.now();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, recipient_user_id || null, target_role || null, sender_name, title, message, type || 'SYSTEM', 0, now).run();

  return c.json({ success: true, id });
});

app.post('/api/notifications/:id/read', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.post('/api/notifications/mark-all-read', async (c) => {
  const { userId } = await c.req.json();
  const db = c.env.DB;
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_user_id = ? OR recipient_user_id IS NULL').bind(userId || '').run();
  return c.json({ success: true });
});

// ==========================================
// 10. Scheduled Worker Handler (Monthly reset & 3-year cleanup)
// ==========================================
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = env.DB;
    const now = new Date();
    // Thai Time UTC+7
    const thaiDate = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const day = thaiDate.getUTCDate();
    const month = thaiDate.getUTCMonth(); // 0 = Jan
    const year = thaiDate.getUTCFullYear();

    // 1. Monthly Reset on 1st of every month
    if (day === 1) {
      await db.prepare("UPDATE equipment SET inspection_status = 'PENDING'").run();

      const thaiMonthNames = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const monthName = thaiMonthNames[month];
      const yearBE = year + 543;
      const notifId = 'notif_cron_' + Date.now();
      const notifMsg = `เริ่มตรวจอุปกรณ์ดับเพลิงประจำรอบเดือน${monthName} ${yearBE} ได้แล้ว`;

      // Notify P2, P3, P4
      for (const role of ['P2', 'P3', 'P4']) {
        await db.prepare(`
          INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          `${notifId}_${role}`, null, role, 'ระบบอัตโนมัติ SHE',
          'แจ้งเตือนรอบตรวจอุปกรณ์ประจำเดือน', notifMsg, 'REMINDER', 0, thaiDate.toISOString()
        ).run();
      }
    }

    // 2. Yearly Cleanup on Jan 1st: Delete inspections older than 3 years
    if (day === 1 && month === 0) {
      const cutoffYear = year - 3;
      const cutoffDate = `${cutoffYear}-01-01T00:00:00`;
      await db.prepare("DELETE FROM inspections WHERE inspection_date < ?").bind(cutoffDate).run();
    }
  }
};
