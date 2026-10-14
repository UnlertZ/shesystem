import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, initSchema, sql } from './db.js';
import { startScheduler, runMonthlyReset, runYearlyCleanup } from './scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8787;

// Uploads directory for image files
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${Date.now()}_${safeName}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max limit
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/api/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ==========================================
// 0. Health Check & Diagnostics
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    const testResult = await query('SELECT 1 as is_alive');
    res.json({
      status: 'ok',
      service: 'shesystem-azure-sql-api',
      database: 'Azure SQL Database',
      db_alive: Boolean(testResult.recordset && testResult.recordset[0]?.is_alive === 1),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      service: 'shesystem-azure-sql-api',
      database: 'Azure SQL Database',
      error: err.message
    });
  }
});

// ==========================================
// 1. Departments Management Endpoints
// ==========================================
app.get('/api/departments', async (req, res) => {
  try {
    const result = await query('SELECT id, name, created_at FROM dbo.departments ORDER BY created_at ASC');
    res.json({ departments: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อแผนก' });
    }
    const id = `dept_${Date.now()}`;
    const now = new Date().toISOString();
    await query(
      'INSERT INTO dbo.departments (id, name, created_at) VALUES (@id, @name, @created_at)',
      { id, name: name.trim(), created_at: now }
    );
    res.json({ success: true, department: { id, name: name.trim(), created_at: now } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อแผนก' });
    }
    await query('UPDATE dbo.departments SET name = @name WHERE id = @id', { name: name.trim(), id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.departments WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. Positions Management Endpoints
// ==========================================
app.get('/api/positions', async (req, res) => {
  try {
    const result = await query('SELECT id, name, default_role, created_at FROM dbo.positions ORDER BY created_at ASC');
    res.json({ positions: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/positions', async (req, res) => {
  try {
    const { name, default_role } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อระดับ / ตำแหน่ง' });
    }
    const id = `pos_${Date.now()}`;
    const now = new Date().toISOString();
    const role = default_role || 'P1';
    await query(
      'INSERT INTO dbo.positions (id, name, default_role, created_at) VALUES (@id, @name, @default_role, @created_at)',
      { id, name: name.trim(), default_role: role, created_at: now }
    );
    res.json({ success: true, position: { id, name: name.trim(), default_role: role, created_at: now } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/positions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, default_role } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อระดับ / ตำแหน่ง' });
    }
    await query(
      'UPDATE dbo.positions SET name = @name, default_role = @default_role WHERE id = @id',
      { name: name.trim(), default_role: default_role || 'P1', id }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/positions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.positions WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Authentication & Users
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();

    const result = await query(
      'SELECT TOP 1 * FROM dbo.users WHERE LOWER(LTRIM(RTRIM(username))) = LOWER(@username)',
      { username: cleanUsername }
    );
    const user = result.recordset?.[0];

    if (!user) {
      return res.status(404).json({ error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'บัญชีของคุณอยู่ระหว่างรอแอดมินอนุมัติ' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'บัญชีของคุณไม่ได้รับการอนุมัติการใช้งาน' });
    }

    const sanitizedUser = {
      ...user,
      is_safety_committee: Boolean(user.is_safety_committee)
    };

    res.json({ user: sanitizedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, full_name, department, position } = req.body;
    const cleanUsername = (username || '').trim();

    const existingResult = await query(
      'SELECT TOP 1 id FROM dbo.users WHERE LOWER(LTRIM(RTRIM(username))) = LOWER(@username)',
      { username: cleanUsername }
    );
    if (existingResult.recordset?.length > 0) {
      return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
    }

    const role = 'P1';
    const userPosition = (position && position.trim()) ? position.trim() : 'พนักงาน';
    const id = `u_${Date.now()}`;
    const now = new Date().toISOString();
    const displayName = (full_name && full_name.trim()) ? full_name.trim() : cleanUsername;

    await query(`
      INSERT INTO dbo.users (id, username, password, full_name, department, position, role, status, is_safety_committee, created_at, updated_at)
      VALUES (@id, @username, @password, @full_name, @department, @position, @role, 'pending', 0, @created_at, @updated_at)
    `, {
      id,
      username: cleanUsername,
      password: password || '123456',
      full_name: displayName,
      department: department || '',
      position: userPosition,
      role,
      created_at: now,
      updated_at: now
    });

    // Notify admin
    const notifId = `notif_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, NULL, 'P3', @sender, @title, @message, 'SYSTEM', 0, @created_at)
    `, {
      id: notifId,
      sender: 'ระบบสมัครสมาชิก',
      title: 'มีสมาชิกรอการอนุมัติ',
      message: `ผู้ใช้ ${displayName} (${department || ''} - ${userPosition}) สมัครสมาชิกเข้าสู่ระบบ รอการอนุมัติ`,
      created_at: now
    });

    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ รอแอดมินอนุมัติ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    const cleanUsername = (username || '').trim();
    const now = new Date().toISOString();

    const userResult = await query(
      'SELECT TOP 1 id, username, department FROM dbo.users WHERE LOWER(LTRIM(RTRIM(username))) = LOWER(@username)',
      { username: cleanUsername }
    );
    const user = userResult.recordset?.[0];

    if (!user) {
      return res.status(404).json({ error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' });
    }

    const resetId = `rst_${Date.now()}`;
    await query(
      'INSERT INTO dbo.password_resets (id, username, status, requested_at) VALUES (@id, @username, \'PENDING\', @requested_at)',
      { id: resetId, username: user.username, requested_at: now }
    );

    // Notify admin
    const notifId = `notif_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, NULL, 'P3', @sender, @title, @message, 'PASSWORD_RESET', 0, @created_at)
    `, {
      id: notifId,
      sender: user.username,
      title: 'คำขอรีเซ็ทรหัสผ่าน',
      message: `ผู้ใช้ ${user.username} ขอรีเซ็ทรหัสผ่าน กรุณาตรวจสอบและดำเนินการ`,
      created_at: now
    });

    res.json({ success: true, message: 'ส่งคำขอรีเซ็ทรหัสผ่านไปยังแอดมินเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. User Management Endpoints
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, username, password, full_name, pending_full_name, department, position, role,
             status, is_safety_committee, avatar_url, created_at, updated_at
      FROM dbo.users
      ORDER BY created_at DESC
    `);
    const users = (result.recordset || []).map((u) => ({
      ...u,
      is_safety_committee: Boolean(u.is_safety_committee)
    }));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const data = req.body;
    const id = `u_${Date.now()}`;
    const now = new Date().toISOString();

    await query(`
      INSERT INTO dbo.users (id, username, password, full_name, department, position, role, status, is_safety_committee, avatar_url, created_at, updated_at)
      VALUES (@id, @username, @password, @full_name, @department, @position, @role, 'approved', @is_safety_committee, @avatar_url, @created_at, @updated_at)
    `, {
      id,
      username: data.username,
      password: data.password || '123456',
      full_name: data.full_name || data.username,
      department: data.department || '',
      position: data.position || '',
      role: data.role || 'P1',
      is_safety_committee: data.is_safety_committee ? 1 : 0,
      avatar_url: data.avatar_url || '',
      created_at: now,
      updated_at: now
    });

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const now = new Date().toISOString();

    await query(`
      UPDATE dbo.users SET
        full_name = COALESCE(@full_name, full_name),
        department = COALESCE(@department, department),
        position = COALESCE(@position, position),
        role = COALESCE(@role, role),
        status = COALESCE(@status, status),
        is_safety_committee = COALESCE(@is_safety_committee, is_safety_committee),
        password = COALESCE(@password, password),
        avatar_url = COALESCE(@avatar_url, avatar_url),
        updated_at = @updated_at
      WHERE id = @id
    `, {
      full_name: data.full_name || null,
      department: data.department || null,
      position: data.position || null,
      role: data.role || null,
      status: data.status || null,
      is_safety_committee: data.is_safety_committee !== undefined ? (data.is_safety_committee ? 1 : 0) : null,
      password: data.password || null,
      avatar_url: data.avatar_url || null,
      updated_at: now,
      id
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Appoint or Revoke คปอ Status
app.put('/api/users/:id/safety-committee', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_safety_committee, admin_name } = req.body;
    const now = new Date().toISOString();
    const isCommittee = is_safety_committee ? 1 : 0;

    await query('UPDATE dbo.users SET is_safety_committee = @isCommittee, updated_at = @now WHERE id = @id', {
      isCommittee,
      now,
      id
    });

    const notifId = `notif_${Date.now()}`;
    const title = is_safety_committee ? 'คุณได้รับการแต่งตั้งเป็นคณะกรรมการ คปอ.' : 'แจ้งปรับสถานะคณะกรรมการ คปอ.';
    const message = is_safety_committee
      ? `คุณได้รับการแต่งตั้งให้เป็น คณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน (คปอ.) โดย ${admin_name || 'แอดมิน'}`
      : `คุณพ้นจากสถานะ คณะกรรมการความปลอดภัย (คปอ.) เรียบร้อยแล้ว`;

    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, @recipient_user_id, NULL, @sender_name, @title, @message, 'SYSTEM', 0, @created_at)
    `, {
      id: notifId,
      recipient_user_id: id,
      sender_name: admin_name || 'แอดมิน',
      title,
      message,
      created_at: now
    });

    res.json({ success: true, is_safety_committee: Boolean(is_safety_committee) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const status = approved ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    await query('UPDATE dbo.users SET status = @status, updated_at = @now WHERE id = @id', {
      status,
      now,
      id
    });

    const notifId = `notif_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, @recipient_user_id, NULL, @sender_name, @title, @message, 'SYSTEM', 0, @created_at)
    `, {
      id: notifId,
      recipient_user_id: id,
      sender_name: 'แอดมิน',
      title: approved ? 'บัญชีของคุณได้รับการอนุมัติแล้ว' : 'บัญชีของคุณไม่ได้รับการอนุมัติ',
      message: approved ? 'คุณสามารถเข้าสู่ระบบและเริ่มใช้งาน SHE System ได้ทันที' : 'ขออภัย บัญชีของคุณไม่ได้รับการอนุมัติการใช้งาน',
      created_at: now
    });

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();
    await query('UPDATE dbo.users SET password = \'0000\', updated_at = @now WHERE id = @id', { now, id });
    res.json({ success: true, message: 'รีเซ็ทรหัสผ่านเป็น 0000 เรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const now = new Date().toISOString();
    await query('UPDATE dbo.users SET password = @newPassword, updated_at = @now WHERE id = @id', {
      newPassword,
      now,
      id
    });
    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request Name Change
app.post('/api/users/:id/request-name-change', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_full_name } = req.body;
    const now = new Date().toISOString();

    if (!new_full_name || !new_full_name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุลใหม่' });
    }

    const cleanName = new_full_name.trim();
    const userRes = await query('SELECT TOP 1 id, username, full_name, department FROM dbo.users WHERE id = @id', { id });
    const user = userRes.recordset?.[0];
    if (!user) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
    }

    await query('UPDATE dbo.users SET pending_full_name = @cleanName, updated_at = @now WHERE id = @id', {
      cleanName,
      now,
      id
    });

    const notifId = `notif_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, NULL, 'P3', @sender, @title, @message, 'SYSTEM', 0, @created_at)
    `, {
      id: notifId,
      sender: 'ระบบเปลี่ยนชื่อ-นามสกุล',
      title: 'มีคำขออนุมัติเปลี่ยนชื่อ-นามสกุล',
      message: `ผู้ใช้ ${user.full_name || user.username} (${user.department}) ขอเปลี่ยนชื่อเป็น "${cleanName}" กรุณาตรวจสอบและอนุมัติในหน้าจัดการสมาชิก`,
      created_at: now
    });

    res.json({ success: true, pending_full_name: cleanName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Name Change
app.post('/api/users/:id/approve-name-change', async (req, res) => {
  try {
    const { id } = req.params;
    const { approve, admin_name } = req.body;
    const now = new Date().toISOString();

    const userRes = await query('SELECT TOP 1 id, username, full_name, pending_full_name FROM dbo.users WHERE id = @id', { id });
    const user = userRes.recordset?.[0];
    if (!user) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้งาน' });
    }

    const targetPendingName = user.pending_full_name;
    if (!targetPendingName) {
      return res.status(400).json({ error: 'ไม่มีคำขอเปลี่ยนชื่อที่ค้างอยู่' });
    }

    if (approve) {
      await query('UPDATE dbo.users SET full_name = @targetPendingName, pending_full_name = NULL, updated_at = @now WHERE id = @id', {
        targetPendingName,
        now,
        id
      });
    } else {
      await query('UPDATE dbo.users SET pending_full_name = NULL, updated_at = @now WHERE id = @id', { now, id });
    }

    const notifId = `notif_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, @recipient_user_id, NULL, @sender_name, @title, @message, 'SYSTEM', 0, @created_at)
    `, {
      id: notifId,
      recipient_user_id: id,
      sender_name: admin_name || 'แอดมิน',
      title: approve ? 'คำขอเปลี่ยนชื่อได้รับการอนุมัติแล้ว' : 'คำขอเปลี่ยนชื่อไม่ได้รับการอนุมัติ',
      message: approve
        ? `แอดมินได้อนุมัติการเปลี่ยนชื่อของคุณเป็น "${targetPendingName}" เรียบร้อยแล้ว`
        : `ขออภัย คำขอเปลี่ยนชื่อเป็น "${targetPendingName}" ไม่ได้รับการอนุมัติจากแอดมิน`,
      created_at: now
    });

    res.json({ success: true, approved: Boolean(approve), new_full_name: approve ? targetPendingName : user.full_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.users WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. Equipment Management Endpoints
// ==========================================
app.get('/api/equipment', async (req, res) => {
  try {
    const { type } = req.query;
    let queryText = 'SELECT * FROM dbo.equipment';
    const params = {};
    if (type) {
      queryText += ' WHERE type = @type';
      params.type = type;
    }
    queryText += ' ORDER BY sequence_number ASC';
    const result = await query(queryText, params);
    res.json({ equipment: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/equipment/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลรายการอุปกรณ์' });
    }

    const now = new Date().toISOString();
    const existingRes = await query('SELECT type, sequence_number FROM dbo.equipment');
    const existing = existingRes.recordset || [];

    const seqsByType = {};
    for (const row of existing) {
      const t = String(row.type || 'EX').toUpperCase();
      if (!seqsByType[t]) seqsByType[t] = new Set();
      seqsByType[t].add(Number(row.sequence_number));
    }

    const createdEquipment = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const type = String(item.type || 'EX').toUpperCase().trim();
      if (!seqsByType[type]) seqsByType[type] = new Set();

      let vacantSeq = 1;
      while (seqsByType[type].has(vacantSeq)) {
        vacantSeq++;
      }
      seqsByType[type].add(vacantSeq);

      const code = `${type}-${String(vacantSeq).padStart(3, '0')}`;
      const id = `eq_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${idx}`;

      const newEquip = {
        id,
        type,
        code,
        sequence_number: vacantSeq,
        category: item.category || '',
        weight: item.weight || '',
        location: item.location || '',
        in_service_date: item.in_service_date || '',
        inspection_sheet_photo: item.inspection_sheet_photo || '',
        location_photo: item.location_photo || '',
        ready_status: item.ready_status || 'READY',
        inspection_status: item.inspection_status || 'PENDING',
        responsible_person: item.responsible_person || '',
        defect_status: item.defect_status || 'NORMAL',
        defect_notes: '',
        created_at: now,
        updated_at: now
      };

      await query(`
        INSERT INTO dbo.equipment (
          id, type, code, sequence_number, category, weight, location, in_service_date,
          inspection_sheet_photo, location_photo, ready_status, inspection_status,
          responsible_person, defect_status, defect_notes, created_at, updated_at
        ) VALUES (
          @id, @type, @code, @sequence_number, @category, @weight, @location, @in_service_date,
          @inspection_sheet_photo, @location_photo, @ready_status, @inspection_status,
          @responsible_person, @defect_status, @defect_notes, @created_at, @updated_at
        )
      `, newEquip);

      createdEquipment.push(newEquip);
    }

    res.json({ success: true, count: createdEquipment.length, equipment: createdEquipment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/equipment', async (req, res) => {
  try {
    const data = req.body;
    const type = data.type || 'EX';

    const existingRes = await query('SELECT sequence_number FROM dbo.equipment WHERE type = @type ORDER BY sequence_number ASC', { type });
    const existing = existingRes.recordset || [];
    const seqs = new Set(existing.map((e) => Number(e.sequence_number)));

    let vacantSeq = 1;
    while (seqs.has(vacantSeq)) {
      vacantSeq++;
    }

    const code = `${type}-${String(vacantSeq).padStart(3, '0')}`;
    const id = `eq_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    await query(`
      INSERT INTO dbo.equipment (
        id, type, code, sequence_number, category, weight, location, in_service_date,
        inspection_sheet_photo, location_photo, ready_status, inspection_status,
        responsible_person, defect_status, defect_notes, created_at, updated_at
      ) VALUES (
        @id, @type, @code, @sequence_number, @category, @weight, @location, @in_service_date,
        @inspection_sheet_photo, @location_photo, 'READY', 'PENDING',
        @responsible_person, 'NORMAL', '', @created_at, @updated_at
      )
    `, {
      id,
      type,
      code,
      sequence_number: vacantSeq,
      category: data.category || '',
      weight: data.weight || '',
      location: data.location || '',
      in_service_date: data.in_service_date || '',
      inspection_sheet_photo: data.inspection_sheet_photo || '',
      location_photo: data.location_photo || '',
      responsible_person: data.responsible_person || '',
      created_at: now,
      updated_at: now
    });

    res.json({ success: true, id, code, sequence_number: vacantSeq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const now = new Date().toISOString();

    await query(`
      UPDATE dbo.equipment SET
        category = @category,
        weight = @weight,
        location = @location,
        in_service_date = @in_service_date,
        inspection_sheet_photo = COALESCE(@inspection_sheet_photo, inspection_sheet_photo),
        location_photo = COALESCE(@location_photo, location_photo),
        responsible_person = @responsible_person,
        updated_at = @now
      WHERE id = @id
    `, {
      category: data.category || '',
      weight: data.weight || '',
      location: data.location || '',
      in_service_date: data.in_service_date || '',
      inspection_sheet_photo: data.inspection_sheet_photo || null,
      location_photo: data.location_photo || null,
      responsible_person: data.responsible_person || '',
      now,
      id
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.equipment WHERE id = @id', { id });
    res.json({ success: true, message: 'ลบอุปกรณ์เรียบร้อยแล้ว เลขรหัสจะถูกนำกลับมาใช้ใหม่อัตโนมัติ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/equipment/:id/resolve-defect', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, resolver_name } = req.body;
    const now = new Date().toISOString();
    const defectNotes = `แก้ไขเรียบร้อยโดย ${resolver_name}: ${notes || 'ตรวจสอบและแก้ไขตามมาตรฐานแล้ว'}`;

    await query(`
      UPDATE dbo.equipment SET
        ready_status = 'READY',
        defect_status = 'RESOLVED',
        defect_notes = @defectNotes,
        updated_at = @now
      WHERE id = @id
    `, { defectNotes, now, id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. Inspection Submission & History
// ==========================================
app.get('/api/inspections', async (req, res) => {
  try {
    const { equipmentId } = req.query;
    let queryText = 'SELECT * FROM dbo.inspections';
    const params = {};
    if (equipmentId) {
      queryText += ' WHERE equipment_id = @equipmentId';
      params.equipmentId = equipmentId;
    }
    queryText += ' ORDER BY inspection_date DESC';
    const result = await query(queryText, params);
    res.json({ inspections: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inspections', async (req, res) => {
  try {
    const data = req.body;
    const now = new Date().toISOString();
    const inspId = `insp_${Date.now()}`;

    const isAbnormal = data.is_abnormal ? 1 : 0;
    const readyStatus = isAbnormal ? 'NOT_READY' : (data.ready_status || 'READY');
    const defectStatus = isAbnormal ? 'DEFECT' : (data.defect_resolved ? 'RESOLVED' : 'NORMAL');
    const checklistStr = typeof data.checklist_results === 'string'
      ? data.checklist_results
      : JSON.stringify(data.checklist_results || {});

    // Insert inspection record
    await query(`
      INSERT INTO dbo.inspections (
        id, equipment_id, inspector_id, inspector_name, inspection_date,
        ready_status, checklist_results, inspection_photo, location_photo,
        is_abnormal, abnormal_description, defect_resolved, created_at
      ) VALUES (
        @id, @equipment_id, @inspector_id, @inspector_name, @inspection_date,
        @ready_status, @checklist_results, @inspection_photo, @location_photo,
        @is_abnormal, @abnormal_description, @defect_resolved, @created_at
      )
    `, {
      id: inspId,
      equipment_id: data.equipment_id,
      inspector_id: data.inspector_id,
      inspector_name: data.inspector_name,
      inspection_date: now,
      ready_status: readyStatus,
      checklist_results: checklistStr,
      inspection_photo: data.inspection_photo || '',
      location_photo: data.location_photo || '',
      is_abnormal: isAbnormal,
      abnormal_description: data.abnormal_description || '',
      defect_resolved: data.defect_resolved ? 1 : 0,
      created_at: now
    });

    // Update equipment
    const defectNotes = data.abnormal_description || (defectStatus === 'RESOLVED' ? 'ปัญหาได้รับการแก้ไขเรียบร้อยแล้ว' : '');
    await query(`
      UPDATE dbo.equipment SET
        ready_status = @readyStatus,
        inspection_status = 'INSPECTED',
        latest_inspector = @inspector_name,
        latest_inspection_date = @now,
        defect_status = @defectStatus,
        defect_notes = @defectNotes,
        inspection_sheet_photo = COALESCE(@inspection_photo, inspection_sheet_photo),
        defect_photo = COALESCE(@defect_photo, defect_photo),
        updated_at = @now
      WHERE id = @equipment_id
    `, {
      readyStatus,
      inspector_name: data.inspector_name,
      now,
      defectStatus,
      defectNotes,
      inspection_photo: data.inspection_photo || null,
      defect_photo: (isAbnormal && data.inspection_photo) ? data.inspection_photo : null,
      equipment_id: data.equipment_id
    });

    // If abnormal, notify admins
    if (isAbnormal) {
      const notifId = `notif_${Date.now()}`;
      await query(`
        INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
        VALUES (@id, NULL, 'P3', @sender, @title, @message, 'DEFECT', 0, @created_at)
      `, {
        id: notifId,
        sender: data.inspector_name,
        title: 'แจ้งเตือนพบอุปกรณ์ชำรุด/ผิดปกติ',
        message: `อุปกรณ์ ${data.equipment_code || data.equipment_id} พบปัญหา: ${data.abnormal_description}`,
        created_at: now
      });
    }

    // Complete task if linked
    if (data.task_id) {
      await query('UPDATE dbo.tasks SET status = \'COMPLETED\', updated_at = @now WHERE id = @task_id', {
        now,
        task_id: data.task_id
      });
    }

    res.json({ success: true, inspection_id: inspId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. Image Upload & File Serving Endpoints
// ==========================================
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพที่อัปโหลด' });
    }
    const fileKey = `photos/${req.file.filename}`;
    const url = `/api/images/${fileKey}`;
    res.json({ success: true, key: fileKey, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/images/*', (req, res) => {
  try {
    const subPath = req.params[0] || req.path.replace(/^\/api\/images\//, '');
    const filename = path.basename(subPath);
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.sendFile(filePath);
    }

    res.status(404).send('Image Not Found');
  } catch (err) {
    res.status(500).send('Error loading image');
  }
});

// ==========================================
// 8. Tasks Management
// ==========================================
app.get('/api/tasks', async (req, res) => {
  try {
    const { userId } = req.query;
    let queryText = 'SELECT * FROM dbo.tasks';
    const params = {};
    if (userId) {
      queryText += ' WHERE assigned_to_id = @userId OR assigned_by_id = @userId';
      params.userId = userId;
    }
    queryText += ' ORDER BY created_at DESC';
    const result = await query(queryText, params);
    res.json({ tasks: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const data = req.body;
    const id = `tsk_${Date.now()}`;
    const now = new Date().toISOString();

    await query(`
      INSERT INTO dbo.tasks (
        id, title, description, equipment_id, assigned_by_id, assigned_by_name,
        assigned_to_id, assigned_to_name, status, task_type, due_date, created_at, updated_at
      ) VALUES (
        @id, @title, @description, @equipment_id, @assigned_by_id, @assigned_by_name,
        @assigned_to_id, @assigned_to_name, 'PENDING', @task_type, @due_date, @created_at, @updated_at
      )
    `, {
      id,
      title: data.title,
      description: data.description || '',
      equipment_id: data.equipment_id || null,
      assigned_by_id: data.assigned_by_id,
      assigned_by_name: data.assigned_by_name,
      assigned_to_id: data.assigned_to_id,
      assigned_to_name: data.assigned_to_name,
      task_type: data.task_type || 'INSPECTION',
      due_date: data.due_date || '',
      created_at: now,
      updated_at: now
    });

    const notifId = `notif_${Date.now()}`;
    const assignerName = data.assigned_by_name || 'ผู้มอบหมายงาน';
    const dueDateMsg = data.due_date ? ` (กำหนดเสร็จ: ${data.due_date})` : '';

    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, @recipient_user_id, NULL, @sender_name, @title, @message, 'TASK', 0, @created_at)
    `, {
      id: notifId,
      recipient_user_id: data.assigned_to_id,
      sender_name: assignerName,
      title: 'คุณได้รับมอบหมายงานใหม่',
      message: `คุณได้รับมอบหมายงาน: "${data.title}" จาก ${assignerName}${dueDateMsg}`,
      created_at: now
    });

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completer_name, notes } = req.body;
    const now = new Date().toISOString();

    const taskRes = await query('SELECT TOP 1 * FROM dbo.tasks WHERE id = @id', { id });
    const existingTask = taskRes.recordset?.[0];
    if (!existingTask) {
      return res.status(404).json({ error: 'ไม่พบงานที่ระบุ' });
    }

    if (status === 'COMPLETED' && existingTask.status === 'COMPLETED') {
      return res.json({ success: true, message: 'Already completed' });
    }

    const completedAt = status === 'COMPLETED' ? now : null;

    await query(`
      UPDATE dbo.tasks SET
        status = @status,
        updated_at = @now,
        completed_at = @completedAt,
        completion_notes = @notes
      WHERE id = @id
    `, {
      status,
      now,
      completedAt,
      notes: notes || '',
      id
    });

    if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED' && existingTask.assigned_by_id) {
      const notifId = `notif_${Date.now()}`;
      const doerName = completer_name || existingTask.assigned_to_name || 'ผู้รับมอบหมาย';
      const notesMsg = notes ? ` (บันทึก: ${notes})` : '';

      await query(`
        INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
        VALUES (@id, @recipient_user_id, NULL, @sender_name, @title, @message, 'TASK', 0, @created_at)
      `, {
        id: notifId,
        recipient_user_id: existingTask.assigned_by_id,
        sender_name: doerName,
        title: 'งานที่มอบหมายดำเนินการเสร็จสิ้นแล้ว',
        message: `งาน "${existingTask.title}" ได้รับการทำสำเร็จเรียบร้อยแล้ว โดย ${doerName}${notesMsg}`,
        created_at: now
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.tasks WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. Notifications
// ==========================================
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.query.userId || '';
    const role = req.query.role || '';

    if (role === 'GUEST' || String(userId).startsWith('guest')) {
      return res.json({ notifications: [] });
    }

    const result = await query(`
      SELECT TOP 50 n.* FROM dbo.notifications n
      WHERE (n.recipient_user_id = @userId OR n.recipient_user_id IS NULL)
        AND (n.target_role IS NULL OR n.target_role = 'ALL' OR n.target_role = @role)
        AND n.id NOT IN (
          SELECT notification_id FROM dbo.user_dismissed_notifications WHERE user_id = @userId
        )
      ORDER BY n.created_at DESC
    `, { userId, role });

    const rawList = result.recordset || [];
    const deduplicated = [];

    for (const n of rawList) {
      const isDuplicate = deduplicated.some((existing) => {
        if (existing.recipient_user_id === n.recipient_user_id && existing.title === n.title && existing.message === n.message) {
          return true;
        }
        if (
          existing.recipient_user_id === n.recipient_user_id &&
          existing.title === n.title &&
          Math.abs(new Date(existing.created_at).getTime() - new Date(n.created_at).getTime()) < 60000
        ) {
          return true;
        }
        return false;
      });

      if (!isDuplicate) {
        deduplicated.push({
          ...n,
          is_read: Boolean(n.is_read)
        });
      }
    }

    res.json({ notifications: deduplicated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/send', async (req, res) => {
  try {
    const { recipient_user_id, target_role, sender_name, title, message, type } = req.body;
    const id = `notif_${Date.now()}`;
    const now = new Date().toISOString();

    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, @recipient_user_id, @target_role, @sender_name, @title, @message, @type, 0, @created_at)
    `, {
      id,
      recipient_user_id: recipient_user_id || null,
      target_role: target_role || null,
      sender_name: sender_name || 'ระบบ',
      title: title || '',
      message: message || '',
      type: type || 'SYSTEM',
      created_at: now
    });

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE dbo.notifications SET is_read = 1 WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const { userId } = req.body;
    await query('UPDATE dbo.notifications SET is_read = 1 WHERE recipient_user_id = @userId OR recipient_user_id IS NULL', {
      userId: userId || ''
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/clear', async (req, res) => {
  try {
    const { user_id, notification_id } = req.body;
    const now = new Date().toISOString();

    if (!user_id) {
      return res.json({ success: true });
    }

    if (notification_id) {
      await query('DELETE FROM dbo.notifications WHERE id = @notification_id AND recipient_user_id = @user_id', {
        notification_id,
        user_id
      });

      await query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.user_dismissed_notifications WHERE user_id = @user_id AND notification_id = @notification_id)
        BEGIN
          INSERT INTO dbo.user_dismissed_notifications (user_id, notification_id, dismissed_at)
          VALUES (@user_id, @notification_id, @now);
        END
      `, { user_id, notification_id, now });
    } else {
      await query('DELETE FROM dbo.notifications WHERE recipient_user_id = @user_id', { user_id });

      await query(`
        INSERT INTO dbo.user_dismissed_notifications (user_id, notification_id, dismissed_at)
        SELECT @user_id, id, @now FROM dbo.notifications
        WHERE (recipient_user_id IS NULL OR recipient_user_id = @user_id)
          AND id NOT IN (SELECT notification_id FROM dbo.user_dismissed_notifications WHERE user_id = @user_id)
      `, { user_id, now });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId || '';
    const now = new Date().toISOString();

    if (userId) {
      await query('DELETE FROM dbo.notifications WHERE id = @id AND recipient_user_id = @userId', { id, userId });
      await query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.user_dismissed_notifications WHERE user_id = @userId AND notification_id = @id)
        BEGIN
          INSERT INTO dbo.user_dismissed_notifications (user_id, notification_id, dismissed_at)
          VALUES (@userId, @id, @now);
        END
      `, { userId, id, now });
    } else {
      await query('DELETE FROM dbo.notifications WHERE id = @id', { id });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. Safety Committee (คปอ.) Endpoints
// ==========================================
app.get('/api/safety-patrols', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM dbo.safety_findings f WHERE f.patrol_id = p.id) as findings_count
      FROM dbo.safety_patrols p
      ORDER BY p.patrol_date DESC, p.created_at DESC
    `);
    res.json({ patrols: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/safety-patrols', async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || `patrol_${Date.now()}`;
    const now = data.created_at || new Date().toISOString();
    const title = data.title || `เดินตรวจ คปอ ประจำวันที่ ${data.patrol_date}`;
    const timeRange = data.time_range || `${data.start_time || '10:00'}น.-${data.end_time || '11:00'}น.`;

    await query(`
      INSERT INTO dbo.safety_patrols (
        id, title, patrol_date, start_time, end_time, time_range,
        location, description, status, created_by_id, created_by_name,
        created_at, updated_at
      ) VALUES (
        @id, @title, @patrol_date, @start_time, @end_time, @time_range,
        @location, @description, @status, @created_by_id, @created_by_name,
        @created_at, @updated_at
      )
    `, {
      id,
      title,
      patrol_date: data.patrol_date,
      start_time: data.start_time || '10:00',
      end_time: data.end_time || '11:00',
      time_range: timeRange,
      location: data.location || 'ทั่วทั้งโรงงาน',
      description: data.description || '',
      status: data.status || 'OPEN',
      created_by_id: data.created_by_id,
      created_by_name: data.created_by_name,
      created_at: now,
      updated_at: now
    });

    const notifId = `notif_patrol_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, NULL, 'ALL', @sender_name, @title, @message, 'SYSTEM', 0, @created_at)
    `, {
      id: notifId,
      sender_name: data.created_by_name || 'แอดมิน คปอ.',
      title: 'เปิดรอบเดินตรวจ คปอ. ใหม่',
      message: `มีรายการเดินตรวจ คปอ. วันที่ ${data.patrol_date} (${timeRange}) สมาชิก คปอ. สามารถกดเข้าร่วมเพื่อบันทึกข้อมูลได้แล้ว`,
      created_at: now
    });

    res.json({
      success: true,
      patrol: {
        id,
        title,
        patrol_date: data.patrol_date,
        start_time: data.start_time || '10:00',
        end_time: data.end_time || '11:00',
        time_range: timeRange,
        location: data.location || 'ทั่วทั้งโรงงาน',
        description: data.description || '',
        status: data.status || 'OPEN',
        created_by_id: data.created_by_id,
        created_by_name: data.created_by_name,
        created_at: now,
        findings_count: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/safety-patrols/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const now = new Date().toISOString();
    await query('UPDATE dbo.safety_patrols SET status = @status, updated_at = @now WHERE id = @id', { status, now, id });
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/safety-patrols/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.safety_findings WHERE patrol_id = @id', { id });
    await query('DELETE FROM dbo.safety_patrols WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10.2 Safety Findings
app.get('/api/safety-findings', async (req, res) => {
  try {
    const { patrolId, category } = req.query;
    let queryText = 'SELECT * FROM dbo.safety_findings WHERE 1=1';
    const params = {};
    if (patrolId) {
      queryText += ' AND patrol_id = @patrolId';
      params.patrolId = patrolId;
    }
    if (category) {
      queryText += ' AND category = @category';
      params.category = category;
    }
    queryText += ' ORDER BY created_at DESC';
    const result = await query(queryText, params);
    res.json({ findings: result.recordset || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/safety-findings', async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || `find_${Date.now()}`;
    const now = data.created_at || new Date().toISOString();

    const isRecommend = data.category === 'RECOMMEND';
    const defaultStatus = isRecommend ? 'PENDING_ACTION' : 'COMMENDED';

    await query(`
      INSERT INTO dbo.safety_findings (
        id, patrol_id, category, sub_type, location, description,
        recommendation, photo_url, reporter_id, reporter_name,
        reporter_department, status, created_at, updated_at
      ) VALUES (
        @id, @patrol_id, @category, @sub_type, @location, @description,
        @recommendation, @photo_url, @reporter_id, @reporter_name,
        @reporter_department, @status, @created_at, @updated_at
      )
    `, {
      id,
      patrol_id: data.patrol_id,
      category: data.category,
      sub_type: data.sub_type || (isRecommend ? 'NEAR_MISS' : 'GOOD_PRACTICE'),
      location: data.location || '',
      description: data.description || '',
      recommendation: data.recommendation || '',
      photo_url: data.photo_url || '',
      reporter_id: data.reporter_id,
      reporter_name: data.reporter_name,
      reporter_department: data.reporter_department || '',
      status: data.status || defaultStatus,
      created_at: now,
      updated_at: now
    });

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/safety-findings/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const now = new Date().toISOString();

    await query(`
      UPDATE dbo.safety_findings SET
        after_photo_url = @after_photo_url,
        action_taken = @action_taken,
        resolved_by_id = @resolved_by_id,
        resolved_by_name = @resolved_by_name,
        resolved_at = @now,
        status = 'PENDING_REVIEW',
        reject_reason = NULL,
        updated_at = @now
      WHERE id = @id
    `, {
      after_photo_url: data.after_photo_url || '',
      action_taken: data.action_taken || '',
      resolved_by_id: data.resolved_by_id,
      resolved_by_name: data.resolved_by_name,
      now,
      id
    });

    const notifId = `notif_rev_${Date.now()}`;
    await query(`
      INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
      VALUES (@id, NULL, 'P3', @sender, @title, @message, 'TASK', 0, @created_at)
    `, {
      id: notifId,
      sender: data.resolved_by_name || 'สมาชิก คปอ.',
      title: 'มีการส่งผลแก้ไขปัญหา (Before/After) รอตรวจสอบ',
      message: `รายการที่ "${data.location || 'คปอ.'}" ได้รับการแก้ไขและแนบรูปผลการแก้ไขแล้ว กรุณาเข้าตรวจสอบผล`,
      created_at: now
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/safety-findings/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, reviewer_id, reviewer_name, reject_reason } = req.body;
    const now = new Date().toISOString();

    const findingRes = await query('SELECT TOP 1 * FROM dbo.safety_findings WHERE id = @id', { id });
    const finding = findingRes.recordset?.[0];
    if (!finding) {
      return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการตรวจสอบ' });
    }

    const newStatus = approved ? 'APPROVED' : 'REJECTED';

    await query(`
      UPDATE dbo.safety_findings SET
        status = @newStatus,
        reviewed_by_id = @reviewer_id,
        reviewed_by_name = @reviewer_name,
        reviewed_at = @now,
        reject_reason = @reject_reason,
        updated_at = @now
      WHERE id = @id
    `, {
      newStatus,
      reviewer_id,
      reviewer_name,
      now,
      reject_reason: approved ? null : (reject_reason || 'ต้องดำเนินการแก้ไขเพิ่มเติม'),
      id
    });

    const targetUserId = finding.resolved_by_id || finding.reporter_id;
    if (targetUserId) {
      const notifId = `notif_review_${Date.now()}`;
      const title = approved ? 'การแก้ไขปัญหาผ่านการตรวจสอบแล้ว' : 'ผลการแก้ไขไม่ผ่าน (ส่งกลับไปแก้ใหม่)';
      const message = approved
        ? `รายการที่ "${finding.location}" ผ่านการตรวจสอบจากแอดมิน (${reviewer_name || 'แอดมิน'}) บันทึกผลสำเร็จเรียบร้อยแล้ว`
        : `รายการที่ "${finding.location}" ไม่ผ่านการตรวจสอบ: "${reject_reason || 'กรุณาแก้ไขเพิ่มเติม'}" กรุณาดำเนินการแก้ไขและส่งรูปภาพผลการแก้ไขใหม่อีกครั้ง`;

      await query(`
        INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
        VALUES (@id, @targetUserId, NULL, @sender_name, @title, @message, @type, 0, @created_at)
      `, {
        id: notifId,
        targetUserId,
        sender_name: reviewer_name || 'แอดมิน คปอ.',
        title,
        message,
        type: approved ? 'SYSTEM' : 'ALERT',
        created_at: now
      });
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/safety-findings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.safety_findings WHERE id = @id', { id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. Manual Cron Trigger Endpoints
// ==========================================
app.post('/api/cron/monthly-reset', async (req, res) => {
  try {
    await runMonthlyReset();
    res.json({ success: true, message: 'Monthly reset completed manually' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cron/yearly-cleanup', async (req, res) => {
  try {
    await runYearlyCleanup();
    res.json({ success: true, message: 'Yearly cleanup completed manually' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Start Server
// ==========================================
async function start() {
  try {
    console.log('🚀 กำลังเริ่มต้น SHE System API (Azure SQL Database)...');
    
    // Optional schema setup check (non-blocking)
    initSchema().catch((e) => console.log('Schema init notice:', e.message));

    // Start background cron jobs
    startScheduler();

    app.listen(PORT, () => {
      console.log(`\n============================================================`);
      console.log(`✨ SHE System Azure SQL API รันอยู่ที่: http://localhost:${PORT}`);
      console.log(`📡 Health Check URL: http://localhost:${PORT}/api/health`);
      console.log(`💾 ฐานข้อมูลเป้าหมาย: Microsoft Azure SQL Database`);
      console.log(`============================================================\n`);
    });
  } catch (err) {
    console.error('❌ ไม่สามารถเริ่มต้นเซิร์ฟเวอร์ได้:', err);
    process.exit(1);
  }
}

start();

export default app;
