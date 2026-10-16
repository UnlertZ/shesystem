import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, initSchema, sql } from './db.js';
import { startScheduler, runMonthlyReset, runYearlyCleanup, runRetentionCleanup } from './scheduler.js';
import {
  uploadImageToAzureBlob,
  getAzureBlobStream,
  deleteAzureBlob,
  isBlobStorageConfigured,
  getStorageInfo,
  getContainerClient
} from './blobStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8787;

/**
 * Helper: Insert notification into database
 */
async function insertNotification({ id, recipient_user_id, target_role, sender_name, title, message, type = 'SYSTEM', created_at }) {
  const notifId = id || `notif_${Date.now()}`;
  const now = created_at || new Date().toISOString();
  await query(`
    INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
    VALUES (@id, @recipient_user_id, @target_role, @sender_name, @title, @message, @type, 0, @created_at)
  `, {
    id: notifId,
    recipient_user_id: recipient_user_id || null,
    target_role: target_role || null,
    sender_name: sender_name || 'SHE System',
    title: title || '',
    message: message || '',
    type: type || 'SYSTEM',
    created_at: now
  });

  return notifId;
}

// Uploads directory for image files (local fallback/cache)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer memory storage configuration (allows direct streaming to Azure Blob Storage)
const upload = multer({
  storage: multer.memoryStorage(),
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
// 0. Root & Health Check Endpoints
// ==========================================
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get('/', (req, res) => {
  // If frontend build exists, serve index.html
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    return res.sendFile(indexHtmlPath);
  }

  // Otherwise, return friendly API landing page
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>SHE System - Azure API Service</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; }
        .card { max-width: 650px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h1 { color: #38bdf8; margin-top: 0; font-size: 24px; display: flex; align-items: center; gap: 10px; }
        .badge { background: #059669; color: white; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: normal; }
        .item { margin-bottom: 16px; padding: 12px; background: #0f172a; border-radius: 8px; border-left: 4px solid #38bdf8; font-size: 14px; }
        .item b { color: #94a3b8; display: block; margin-bottom: 4px; font-size: 12px; text-transform: uppercase; }
        .links a { display: inline-block; margin-right: 12px; margin-top: 8px; color: #38bdf8; text-decoration: none; padding: 6px 12px; background: #334155; border-radius: 6px; font-size: 13px; }
        .links a:hover { background: #475569; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🚀 SHE System API Service <span class="badge">Online</span></h1>
        <p style="color: #94a3b8; line-height: 1.6;">โปรเจกต์นี้เป็น <b>REST API Backend</b> สำหรับเชื่อมต่อ Microsoft Azure Portal</p>
        
        <div class="item">
          <b>ฐานข้อมูล (Database)</b>
          Microsoft Azure SQL Database: <code>${process.env.AZURE_SQL_DATABASE || 'shedatabase'}</code> (<code>${process.env.AZURE_SQL_SERVER || 'halls.database.windows.net'}</code>)
        </div>
        
        <div class="item">
          <b>ที่เก็บรูปภาพ (Blob Storage)</b>
          Microsoft Azure Blob Storage: <code>${process.env.AZURE_STORAGE_CONTAINER_NAME || 'picshesystem'}</code>
        </div>
        
        <div class="item">
          <b>หมายเหตุเรื่องหน้าเว็บ (Frontend)</b>
          โค้ดหน้าเว็บ React UI อยู่ที่โฟลเดอร์ <code>shesystem</code> หรือสามารถนำไฟล์ Build มาวางในโฟลเดอร์ <code>dist/</code> ของโปรเจกต์นี้เพื่อเปิดหน้าเว็บได้ทันที
        </div>

        <div class="links">
          <b style="color: #94a3b8; display: block; margin-top: 16px;">Quick API Links:</b>
          <a href="/api/health" target="_blank">📡 /api/health (ตรวจสถานะ)</a>
          <a href="/api/equipment" target="_blank">🧯 /api/equipment</a>
          <a href="/api/departments" target="_blank">🏢 /api/departments</a>
          <a href="/api/users" target="_blank">👥 /api/users</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/health', async (req, res) => {
  const storageInfo = getStorageInfo();
  try {
    const testResult = await query('SELECT 1 as is_alive');
    const isDbAlive = Boolean(testResult.recordset && testResult.recordset[0]?.is_alive === 1);
    res.json({
      status: 'ok',
      service: 'shesystem-azure-sql-api',
      database: {
        type: 'Microsoft Azure SQL Database',
        server: process.env.AZURE_SQL_SERVER || 'halls.database.windows.net',
        name: process.env.AZURE_SQL_DATABASE || 'shedatabase',
        db_alive: isDbAlive
      },
      storage: storageInfo,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      service: 'shesystem-azure-sql-api',
      database: {
        type: 'Microsoft Azure SQL Database',
        server: process.env.AZURE_SQL_SERVER || 'halls.database.windows.net',
        name: process.env.AZURE_SQL_DATABASE || 'shedatabase',
        db_alive: false
      },
      storage: storageInfo,
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
    const { username, password, full_name, email, department, position } = req.body;
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
    const userEmail = (email && email.trim()) ? email.trim() : null;

    await query(`
      INSERT INTO dbo.users (id, username, password, full_name, email, department, position, role, status, is_safety_committee, created_at, updated_at)
      VALUES (@id, @username, @password, @full_name, @email, @department, @position, @role, 'pending', 0, @created_at, @updated_at)
    `, {
      id,
      username: cleanUsername,
      password: password || '123456',
      full_name: displayName,
      email: userEmail,
      department: department || '',
      position: userPosition,
      role,
      created_at: now,
      updated_at: now
    });

    // Notify admin
    await insertNotification({
      target_role: 'P3',
      sender_name: 'ระบบสมัครสมาชิก',
      title: 'มีสมาชิกรอการอนุมัติ',
      message: `ผู้ใช้ ${displayName} (${department || ''} - ${userPosition}) สมัครสมาชิกเข้าสู่ระบบ รอการอนุมัติ`,
      type: 'SYSTEM',
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
    await insertNotification({
      target_role: 'P3',
      sender_name: user.username,
      title: 'คำขอรีเซ็ทรหัสผ่าน',
      message: `ผู้ใช้ ${user.username} ขอรีเซ็ทรหัสผ่าน กรุณาตรวจสอบและดำเนินการ`,
      type: 'PASSWORD_RESET',
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
      SELECT id, username, password, full_name, pending_full_name, email, department, position, role,
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
      INSERT INTO dbo.users (id, username, password, full_name, email, department, position, role, status, is_safety_committee, avatar_url, created_at, updated_at)
      VALUES (@id, @username, @password, @full_name, @email, @department, @position, @role, 'approved', @is_safety_committee, @avatar_url, @created_at, @updated_at)
    `, {
      id,
      username: data.username,
      password: data.password || '123456',
      full_name: data.full_name || data.username,
      email: data.email ? data.email.trim() : null,
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
        email = COALESCE(@email, email),
        department = COALESCE(@department, department),
        position = COALESCE(@position, position),
        role = COALESCE(@role, role),
        status = COALESCE(@status, status),
        is_safety_committee = COALESCE(@is_safety_committee, is_safety_committee),
        password = COALESCE(@password, password),
        avatar_url = COALESCE(@avatar_url, avatar_url),
        updated_at = @updated_at
      WHERE id = @id OR (@username IS NOT NULL AND LOWER(LTRIM(RTRIM(username))) = LOWER(LTRIM(RTRIM(@username))))
    `, {
      full_name: data.full_name || null,
      email: data.email !== undefined ? (data.email ? data.email.trim() : null) : null,
      department: data.department || null,
      position: data.position || null,
      role: data.role || null,
      status: data.status || null,
      is_safety_committee: data.is_safety_committee !== undefined ? (data.is_safety_committee ? 1 : 0) : null,
      password: data.password || null,
      avatar_url: data.avatar_url || null,
      username: data.username || null,
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

    const title = is_safety_committee ? 'คุณได้รับการแต่งตั้งเป็นคณะกรรมการ คปอ.' : 'แจ้งปรับสถานะคณะกรรมการ คปอ.';
    const message = is_safety_committee
      ? `คุณได้รับการแต่งตั้งให้เป็น คณะกรรมการความปลอดภัย อาชีวอนามัย และสภาพแวดล้อมในการทำงาน (คปอ.) โดย ${admin_name || 'แอดมิน'}`
      : `คุณพ้นจากสถานะ คณะกรรมการความปลอดภัย (คปอ.) เรียบร้อยแล้ว`;

    await insertNotification({
      recipient_user_id: id,
      sender_name: admin_name || 'แอดมิน',
      title,
      message,
      type: 'SYSTEM',
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

    await insertNotification({
      recipient_user_id: id,
      sender_name: 'แอดมิน',
      title: approved ? 'บัญชีของคุณได้รับการอนุมัติแล้ว' : 'บัญชีของคุณไม่ได้รับการอนุมัติ',
      message: approved ? 'คุณสามารถเข้าสู่ระบบและเริ่มใช้งาน SHE System ได้ทันที' : 'ขออภัย บัญชีของคุณไม่ได้รับการอนุมัติการใช้งาน',
      type: 'SYSTEM',
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

    await insertNotification({
      target_role: 'P3',
      sender_name: 'ระบบเปลี่ยนชื่อ-นามสกุล',
      title: 'มีคำขออนุมัติเปลี่ยนชื่อ-นามสกุล',
      message: `ผู้ใช้ ${user.full_name || user.username} (${user.department}) ขอเปลี่ยนชื่อเป็น "${cleanName}" กรุณาตรวจสอบและอนุมัติในหน้าจัดการสมาชิก`,
      type: 'SYSTEM',
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

    await insertNotification({
      recipient_user_id: id,
      sender_name: admin_name || 'แอดมิน',
      title: approve ? 'คำขอเปลี่ยนชื่อได้รับการอนุมัติแล้ว' : 'คำขอเปลี่ยนชื่อไม่ได้รับการอนุมัติ',
      message: approve
        ? `แอดมินได้อนุมัติการเปลี่ยนชื่อของคุณเป็น "${targetPendingName}" เรียบร้อยแล้ว`
        : `ขออภัย คำขอเปลี่ยนชื่อเป็น "${targetPendingName}" ไม่ได้รับการอนุมัติจากแอดมิน`,
      type: 'SYSTEM',
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
      await insertNotification({
        target_role: 'P3',
        sender_name: data.inspector_name,
        title: 'แจ้งเตือนพบอุปกรณ์ชำรุด/ผิดปกติ',
        message: `อุปกรณ์ ${data.equipment_code || data.equipment_id} พบปัญหา: ${data.abnormal_description}`,
        type: 'DEFECT',
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

app.put('/api/inspections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { inspection_date, inspector_name } = req.body;
    const now = new Date().toISOString();

    await query(`
      UPDATE dbo.inspections SET
        inspection_date = COALESCE(@inspection_date, inspection_date),
        inspector_name = COALESCE(@inspector_name, inspector_name)
      WHERE id = @id
    `, { id, inspection_date, inspector_name });

    // Update equipment latest inspection date if this was the latest
    const inspRes = await query('SELECT TOP 1 equipment_id FROM dbo.inspections WHERE id = @id', { id });
    if (inspRes.recordset && inspRes.recordset[0]) {
      const eqId = inspRes.recordset[0].equipment_id;
      const latestRes = await query(`
        SELECT TOP 1 inspection_date, inspector_name 
        FROM dbo.inspections 
        WHERE equipment_id = @eqId 
        ORDER BY inspection_date DESC
      `, { eqId });

      if (latestRes.recordset && latestRes.recordset[0]) {
        await query(`
          UPDATE dbo.equipment SET
            latest_inspection_date = @latestDate,
            latest_inspector = @latestInspector,
            updated_at = @now
          WHERE id = @eqId
        `, {
          latestDate: latestRes.recordset[0].inspection_date,
          latestInspector: latestRes.recordset[0].inspector_name,
          now,
          eqId
        });
      }
    }

    res.json({ success: true, message: 'แก้ไขเวลาตรวจเช็คเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/inspections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    const inspRes = await query('SELECT TOP 1 equipment_id FROM dbo.inspections WHERE id = @id', { id });
    const eqId = inspRes.recordset?.[0]?.equipment_id;

    await query('DELETE FROM dbo.inspections WHERE id = @id', { id });

    if (eqId) {
      const latestRes = await query(`
        SELECT TOP 1 inspection_date, inspector_name 
        FROM dbo.inspections 
        WHERE equipment_id = @eqId 
        ORDER BY inspection_date DESC
      `, { eqId });

      const prev = latestRes.recordset?.[0];
      await query(`
        UPDATE dbo.equipment SET
          latest_inspection_date = @latestDate,
          latest_inspector = @latestInspector,
          updated_at = @now
        WHERE id = @eqId
      `, {
        latestDate: prev ? prev.inspection_date : null,
        latestInspector: prev ? prev.inspector_name : null,
        now,
        eqId
      });
    }

    res.json({ success: true, message: 'ลบข้อมูลการตรวจเช็คเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inspections/clear-month', async (req, res) => {
  try {
    const { equipment_id, year, month } = req.body;
    const now = new Date();
    // Thai Time UTC+7
    const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const targetYear = year !== undefined ? Number(year) : thaiNow.getUTCFullYear();
    const targetMonth = month !== undefined ? Number(month) : thaiNow.getUTCMonth();

    const startDate = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0)).toISOString();
    const endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 1, 0, 0, 0)).toISOString();

    let deleteQuery = 'DELETE FROM dbo.inspections WHERE inspection_date >= @startDate AND inspection_date < @endDate';
    const params = { startDate, endDate };

    if (equipment_id) {
      deleteQuery += ' AND equipment_id = @equipment_id';
      params.equipment_id = equipment_id;
    }

    const delRes = await query(deleteQuery, params);

    // Reset equipment status to PENDING
    if (equipment_id) {
      const prevLatest = await query(`
        SELECT TOP 1 inspection_date, inspector_name
        FROM dbo.inspections
        WHERE equipment_id = @equipment_id
        ORDER BY inspection_date DESC
      `, { equipment_id });

      const prev = prevLatest.recordset?.[0];
      await query(`
        UPDATE dbo.equipment SET
          inspection_status = 'PENDING',
          latest_inspection_date = @latestDate,
          latest_inspector = @latestInspector,
          updated_at = @now
        WHERE id = @equipment_id
      `, {
        equipment_id,
        latestDate: prev ? prev.inspection_date : null,
        latestInspector: prev ? prev.inspector_name : null,
        now: now.toISOString()
      });
    } else {
      await query(`UPDATE dbo.equipment SET inspection_status = 'PENDING', updated_at = @now`, {
        now: now.toISOString()
      });
    }

    res.json({
      success: true,
      deletedCount: delRes.rowsAffected?.[0] || 0,
      message: equipment_id
        ? 'ล้างประวัติการตรวจเช็คของอุปกรณ์นี้ในรอบเดือนนี้เรียบร้อยแล้ว'
        : 'ล้างประวัติและรีเซ็ตสถานะการตรวจเช็คของเดือนนี้ทั้งหมดเรียบร้อยแล้ว'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. Image Upload & File Serving Endpoints
// ==========================================
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์รูปภาพที่อัปโหลด' });
    }

    const ext = path.extname(req.file.originalname) || '.jpg';
    const safeName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_');
    const filename = `${Date.now()}_${safeName}${ext}`;
    const fileKey = `photos/${filename}`;

    // Write to local cache / uploads directory as reliable backup
    try {
      const localFilePath = path.join(uploadsDir, filename);
      fs.writeFileSync(localFilePath, req.file.buffer);
    } catch (fsErr) {
      console.warn('⚠️ บันทึกไฟล์ลงแคชในเครื่องไม่สำเร็จ:', fsErr.message);
    }

    // Upload to Microsoft Azure Blob Storage (Container: picshesystem)
    if (isBlobStorageConfigured()) {
      try {
        const uploadResult = await uploadImageToAzureBlob(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype || 'image/jpeg'
        );
        return res.json({
          success: true,
          key: uploadResult.key,
          url: uploadResult.url,
          blob_url: uploadResult.blobUrl,
          storage: 'azure-blob'
        });
      } catch (blobErr) {
        console.warn('⚠️ อัปโหลดไปยัง Azure Blob Storage ไม่สำเร็จ จะใช้การเสิร์ฟไฟล์ผ่าน API ชั่วคราว:', blobErr.message);
      }
    }

    const url = `/api/images/${fileKey}`;
    res.json({ success: true, key: fileKey, url, storage: 'local' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/images/*', async (req, res) => {
  try {
    const subPath = req.params[0] || req.path.replace(/^\/api\/images\//, '');
    const filename = path.basename(subPath);

    // 1. ลองดึงรูปภาพจาก Microsoft Azure Blob Storage (Container: picshesystem) ก่อน
    if (isBlobStorageConfigured()) {
      try {
        const blobData = await getAzureBlobStream(subPath);
        if (blobData && blobData.stream) {
          res.setHeader('Content-Type', blobData.contentType || 'image/jpeg');
          if (blobData.contentLength) {
            res.setHeader('Content-Length', blobData.contentLength);
          }
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          return blobData.stream.pipe(res);
        }
      } catch (blobErr) {
        console.warn('⚠️ ดึงรูปภาพจาก Azure Blob Storage ล้มเหลว ตรวจสอบไฟล์ในเครื่องแทน:', blobErr.message);
      }
    }

    // 2. หากไม่พบใน Blob หรือยังไม่ได้ตั้งค่า Key ให้ค้นหาจากโฟลเดอร์ uploads ในเครื่อง
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.sendFile(filePath);
    }

    // 3. Fallback: ลองดึงจาก Remote Cloudflare R2, Worker หรือ Public Azure Blob
    try {
      const remoteCandidates = [
        `https://pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev/${subPath}`,
        `https://pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev/photos/${filename}`,
        `https://shesystem.anuruk3030.workers.dev/api/images/${subPath}`,
        `https://she-inspection-backend.b-phatcharapong2001.workers.dev/api/images/${subPath}`,
        `https://picshesystem.blob.core.windows.net/picshesystem/${subPath}`
      ];
      for (const rUrl of remoteCandidates) {
        try {
          const resp = await fetch(rUrl, { signal: AbortSignal.timeout(5000) });
          if (resp.ok) {
            const cType = resp.headers.get('content-type');
            if (cType && cType.startsWith('image/')) {
              res.setHeader('Content-Type', cType);
              res.setHeader('Cache-Control', 'public, max-age=31536000');
              const arrayBuffer = await resp.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              // Save to local cache so subsequent requests return instantly
              try {
                fs.writeFileSync(filePath, buffer);
              } catch (_) {}
              return res.send(buffer);
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    res.status(404).send('Image Not Found in Azure Blob Storage or Local Cache');
  } catch (err) {
    res.status(500).send('Error loading image');
  }
});

// ==========================================
// Delete Images from Azure Blob Storage & Database
// ==========================================
app.post('/api/images/delete', async (req, res) => {
  try {
    const {
      type, // 'single_equipment' | 'all_equipment' | 'single_inspection' | 'single_finding' | 'all_patrol' | 'direct'
      equipmentId,
      field, // 'inspection_sheet_photo' | 'location_photo' | 'defect_photo' | 'inspection_photo'
      inspectionId,
      findingId,
      findingField, // 'photo_url' | 'after_photo_url'
      patrolId,
      url
    } = req.body;

    let deletedBlobs = 0;

    const cleanupFile = async (fileUrlOrKey) => {
      if (!fileUrlOrKey) return;
      try {
        await deleteAzureBlob(fileUrlOrKey);
        deletedBlobs++;
      } catch (err) {
        console.warn('⚠️ deleteAzureBlob error:', err.message);
      }
      try {
        const basename = path.basename(fileUrlOrKey);
        const localPath = path.join(uploadsDir, basename);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } catch (_) {}
    };

    // 1. Direct URL/Key deletion
    if (url || type === 'direct') {
      const targetUrl = url || req.body.key;
      if (targetUrl) {
        await cleanupFile(targetUrl);
      }
    }

    // 2. Single Equipment Photo
    if (type === 'single_equipment' && equipmentId && field) {
      const validFields = ['inspection_sheet_photo', 'location_photo', 'defect_photo'];
      if (validFields.includes(field)) {
        const itemRes = await query(`SELECT ${field} FROM dbo.equipment WHERE id = @equipmentId`, { equipmentId });
        const oldUrl = itemRes.recordset?.[0]?.[field];
        if (oldUrl) {
          await cleanupFile(oldUrl);
        }
        await query(`UPDATE dbo.equipment SET ${field} = NULL, updated_at = @now WHERE id = @equipmentId`, {
          equipmentId,
          now: new Date().toISOString()
        });
      }
    }

    // 3. Single Inspection Photo
    if (type === 'single_inspection' && inspectionId && field) {
      const validFields = ['inspection_photo', 'location_photo'];
      if (validFields.includes(field)) {
        const itemRes = await query(`SELECT ${field} FROM dbo.inspections WHERE id = @inspectionId`, { inspectionId });
        const oldUrl = itemRes.recordset?.[0]?.[field];
        if (oldUrl) {
          await cleanupFile(oldUrl);
        }
        await query(`UPDATE dbo.inspections SET ${field} = NULL WHERE id = @inspectionId`, { inspectionId });
      }
    }

    // 4. All Photos of an Equipment
    if (type === 'all_equipment' && equipmentId) {
      const eqRes = await query(
        'SELECT inspection_sheet_photo, location_photo, defect_photo FROM dbo.equipment WHERE id = @equipmentId',
        { equipmentId }
      );
      if (eqRes.recordset?.length > 0) {
        const eq = eqRes.recordset[0];
        for (const f of ['inspection_sheet_photo', 'location_photo', 'defect_photo']) {
          if (eq[f]) {
            await cleanupFile(eq[f]);
          }
        }
        await query(
          'UPDATE dbo.equipment SET inspection_sheet_photo = NULL, location_photo = NULL, defect_photo = NULL, updated_at = @now WHERE id = @equipmentId',
          { equipmentId, now: new Date().toISOString() }
        );
      }

      const inspRes = await query(
        'SELECT id, inspection_photo, location_photo FROM dbo.inspections WHERE equipment_id = @equipmentId',
        { equipmentId }
      );
      for (const insp of inspRes.recordset || []) {
        if (insp.inspection_photo) {
          await cleanupFile(insp.inspection_photo);
        }
        if (insp.location_photo) {
          await cleanupFile(insp.location_photo);
        }
      }
      await query(
        'UPDATE dbo.inspections SET inspection_photo = NULL, location_photo = NULL WHERE equipment_id = @equipmentId',
        { equipmentId }
      );
    }

    // 5. Single Finding Photo
    if (type === 'single_finding' && findingId && findingField) {
      const validFields = ['photo_url', 'after_photo_url'];
      if (validFields.includes(findingField)) {
        const findingRes = await query(`SELECT ${findingField} FROM dbo.safety_findings WHERE id = @findingId`, { findingId });
        const oldUrl = findingRes.recordset?.[0]?.[findingField];
        if (oldUrl) {
          await cleanupFile(oldUrl);
        }
        await query(`UPDATE dbo.safety_findings SET ${findingField} = NULL WHERE id = @findingId`, { findingId });
      }
    }

    // 6. All Photos of a Safety Patrol Round
    if (type === 'all_patrol' && patrolId) {
      const findingsRes = await query(
        'SELECT id, photo_url, after_photo_url FROM dbo.safety_findings WHERE patrol_id = @patrolId',
        { patrolId }
      );
      for (const finding of findingsRes.recordset || []) {
        if (finding.photo_url) {
          await cleanupFile(finding.photo_url);
        }
        if (finding.after_photo_url) {
          await cleanupFile(finding.after_photo_url);
        }
      }
      await query(
        'UPDATE dbo.safety_findings SET photo_url = NULL, after_photo_url = NULL WHERE patrol_id = @patrolId',
        { patrolId }
      );
    }

    res.json({ success: true, message: 'ลบรูปภาพสำเร็จ', deleted_blobs: deletedBlobs });
  } catch (err) {
    console.error('❌ ข้อผิดพลาดในการลบรูปภาพ:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2-Year Retention Purge Trigger Endpoint
app.post('/api/cleanup/retention-2years', async (req, res) => {
  try {
    const result = await runRetentionCleanup(2);
    res.json(result);
  } catch (err) {
    console.error('❌ ข้อผิดพลาดในการรัน Retention Cleanup:', err.message);
    res.status(500).json({ error: err.message });
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

    const assignerName = data.assigned_by_name || 'ผู้มอบหมายงาน';
    const dueDateMsg = data.due_date ? ` (กำหนดเสร็จ: ${data.due_date})` : '';

    await insertNotification({
      recipient_user_id: data.assigned_to_id,
      sender_name: assignerName,
      title: 'คุณได้รับมอบหมายงานใหม่',
      message: `คุณได้รับมอบหมายงาน: "${data.title}" จาก ${assignerName}${dueDateMsg}`,
      type: 'TASK',
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
      const doerName = completer_name || existingTask.assigned_to_name || 'ผู้รับมอบหมาย';
      const notesMsg = notes ? ` (บันทึก: ${notes})` : '';

      await insertNotification({
        recipient_user_id: existingTask.assigned_by_id,
        sender_name: doerName,
        title: 'งานที่มอบหมายดำเนินการเสร็จสิ้นแล้ว',
        message: `งาน "${existingTask.title}" ได้รับการทำสำเร็จเรียบร้อยแล้ว โดย ${doerName}${notesMsg}`,
        type: 'TASK',
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
    const now = new Date().toISOString();

    const id = await insertNotification({
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

    await insertNotification({
      target_role: 'ALL',
      sender_name: data.created_by_name || 'แอดมิน คปอ.',
      title: 'เปิดรอบเดินตรวจ คปอ. ใหม่',
      message: `มีรายการเดินตรวจ คปอ. วันที่ ${data.patrol_date} (${timeRange}) สมาชิก คปอ. สามารถกดเข้าร่วมเพื่อบันทึกข้อมูลได้แล้ว`,
      type: 'SYSTEM',
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

app.put('/api/safety-patrols/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, patrol_date, time_range, location, description } = req.body;
    const now = new Date().toISOString();

    await query(`
      UPDATE dbo.safety_patrols SET
        title = COALESCE(@title, title),
        patrol_date = COALESCE(@patrol_date, patrol_date),
        time_range = COALESCE(@time_range, time_range),
        location = COALESCE(@location, location),
        description = COALESCE(@description, description),
        updated_at = @now
      WHERE id = @id
    `, { id, title, patrol_date, time_range, location, description, now });

    res.json({ success: true, message: 'แก้ไขข้อมูลรอบเดินตรวจเรียบร้อยแล้ว' });
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

    await insertNotification({
      target_role: 'P3',
      sender_name: data.resolved_by_name || 'สมาชิก คปอ.',
      title: 'มีการส่งผลแก้ไขปัญหา (Before/After) รอตรวจสอบ',
      message: `รายการที่ "${data.location || 'คปอ.'}" ได้รับการแก้ไขและแนบรูปผลการแก้ไขแล้ว กรุณาเข้าตรวจสอบผล`,
      type: 'TASK',
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
      const title = approved ? 'การแก้ไขปัญหาผ่านการตรวจสอบแล้ว' : 'ผลการแก้ไขไม่ผ่าน (ส่งกลับไปแก้ใหม่)';
      const message = approved
        ? `รายการที่ "${finding.location}" ผ่านการตรวจสอบจากแอดมิน (${reviewer_name || 'แอดมิน'}) บันทึกผลสำเร็จเรียบร้อยแล้ว`
        : `รายการที่ "${finding.location}" ไม่ผ่านการตรวจสอบ: "${reject_reason || 'กรุณาแก้ไขเพิ่มเติม'}" กรุณาดำเนินการแก้ไขและส่งรูปภาพผลการแก้ไขใหม่อีกครั้ง`;

      await insertNotification({
        recipient_user_id: targetUserId,
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

app.put('/api/safety-findings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, sub_type, location, description, recommendation, photo_url } = req.body;
    const now = new Date().toISOString();

    await query(`
      UPDATE dbo.safety_findings SET
        category = COALESCE(@category, category),
        sub_type = COALESCE(@sub_type, sub_type),
        location = COALESCE(@location, location),
        description = COALESCE(@description, description),
        recommendation = COALESCE(@recommendation, recommendation),
        photo_url = COALESCE(@photo_url, photo_url),
        updated_at = @now
      WHERE id = @id
    `, { id, category, sub_type, location, description, recommendation, photo_url, now });

    res.json({ success: true, message: 'แก้ไขข้อมูลรายการตรวจ คปอ. เรียบร้อยแล้ว' });
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
// SPA Client-Side Routing Fallback
// ==========================================
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const targetDir = fs.existsSync(distDir) ? distDir : path.join(__dirname, '..', 'build');
  const indexFile = path.join(targetDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  next();
});

// ==========================================
// Start Server
// ==========================================
async function start() {
  try {
    console.log('🚀 กำลังเริ่มต้น SHE System API (Azure SQL Database)...');
    
    // Optional schema setup check (non-blocking)
    initSchema().catch((e) => console.log('Schema init notice:', e.message));

    // Ensure email column exists on dbo.users
    try {
      await query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'email')
        BEGIN
          ALTER TABLE dbo.users ADD email NVARCHAR(255) NULL;
        END;
      `);
    } catch (e) {
      console.log('User schema column check notice:', e.message);
    }

    // De-duplicate users table if duplicate records exist for the same username
    try {
      await query(`
        WITH CTE AS (
          SELECT id, username,
                 ROW_NUMBER() OVER(
                   PARTITION BY LOWER(LTRIM(RTRIM(username)))
                   ORDER BY COALESCE(updated_at, created_at) DESC
                 ) as rn
          FROM dbo.users
          WHERE username IS NOT NULL AND LTRIM(RTRIM(username)) <> ''
        )
        DELETE FROM CTE WHERE rn > 1;
      `);
    } catch (e) {
      console.log('User duplicate cleanup notice:', e.message);
    }

    // Normalize any legacy/external R2 photo URLs in database to local/Azure /api/images/ path
    try {
      await query(`
        UPDATE dbo.equipment
        SET inspection_sheet_photo = REPLACE(inspection_sheet_photo, 'https://pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev/', '/api/images/'),
            location_photo = REPLACE(location_photo, 'https://pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev/', '/api/images/')
        WHERE inspection_sheet_photo LIKE '%pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev%'
           OR location_photo LIKE '%pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev%';

        UPDATE dbo.inspection_logs
        SET inspection_sheet_photo = REPLACE(inspection_sheet_photo, 'https://pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev/', '/api/images/'),
            location_photo = REPLACE(location_photo, 'https://pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev/', '/api/images/')
        WHERE inspection_sheet_photo LIKE '%pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev%'
           OR location_photo LIKE '%pub-426ad5b3bf3b47f596fa63ac0ac61749.r2.dev%';
      `);
      console.log('✅ ตรวจสอบและแปลง URL รูปภาพในฐานข้อมูล Azure SQL เรียบร้อย');
    } catch (e) {
      console.log('Photo URL normalization notice:', e.message);
    }

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
