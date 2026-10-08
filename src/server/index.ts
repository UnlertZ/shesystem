import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'shesystem', database: 'd1shesystem', storage: 'r2shesystem' });
});

// 1. Authentication & Users
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  const db = c.env.DB;
  
  const user = await db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  ).bind(username, password).first();

  if (!user) {
    return c.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, 401);
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
  const { username, password, department } = await c.req.json();
  const db = c.env.DB;

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) {
    return c.json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' }, 400);
  }

  const id = 'u_' + Date.now();
  const role = department === 'พนักงาน' ? 'P1' : 'P2';
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO users (id, username, password, department, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, username, password, department, role, 'pending', now, now).run();

  // Notify admin of new registration
  const notifId = 'notif_' + Date.now();
  await db.prepare(
    'INSERT INTO notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(notifId, null, 'P3', 'ระบบสมัครสมาชิก', 'มีสมาชิกรอการอนุมัติ', `ผู้ใช้ ${username} (${department}) สมัครสมาชิกเข้าสู่ระบบ รอการอนุมัติ`, 'SYSTEM', 0, now).run();

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

// 2. User Management (Admin & System Manager)
app.get('/api/users', async (c) => {
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT id, username, department, role, status, avatar_url, created_at FROM users ORDER BY created_at DESC').all();
  return c.json({ users: results });
});

app.post('/api/users/:id/approve', async (c) => {
  const id = c.req.param('id');
  const { approved } = await c.req.json();
  const db = c.env.DB;
  const status = approved ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  await db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();
  return c.json({ success: true, status });
});

app.post('/api/users/:id/reset-password', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  const now = new Date().toISOString();

  // Reset to default "0000" as specified by user
  await db.prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?').bind('0000', now, id).run();
  return c.json({ success: true, message: 'รีเซ็ทรหัสผ่านเป็น 0000 เรียบร้อยแล้ว' });
});

app.patch('/api/users/:id/department', async (c) => {
  const id = c.req.param('id');
  const { department, role } = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare('UPDATE users SET department = ?, role = COALESCE(?, role), updated_at = ? WHERE id = ?').bind(department, role || null, now, id).run();
  return c.json({ success: true });
});

app.patch('/api/users/:id/role', async (c) => {
  const id = c.req.param('id');
  const { role } = await c.req.json();
  const db = c.env.DB;
  const now = new Date().toISOString();

  await db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').bind(role, now, id).run();
  return c.json({ success: true });
});

app.delete('/api/users/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// 3. Equipment Routes with Vacant Sequence Number Reuse for EX
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

// 4. Inspection Submission & Defect Tracking
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
    now, readyStatus, JSON.stringify(data.checklist_results || {}),
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

// 5. Cloudflare R2 Upload Endpoint
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
  return new Response(object.body, { headers });
});

// 6. Tasks Management (Supervisor delegation & Admin assignments)
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

// 7. Notifications
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

// Scheduled Worker Handler (Monthly reset & 3-year cleanup)
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
