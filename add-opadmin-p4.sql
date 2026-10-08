-- คำสั่งเพิ่ม User opadmin รหัสผ่าน halls1999 สิทธิ์ P4 ใน Cloudflare D1 (d1shesystem)
-- สามารถคัดลอกคำสั่งนี้ไปรันใน Cloudflare Dashboard -> D1 -> d1shesystem -> Console ได้ทันที

INSERT INTO users (id, username, password, department, position, role, status, avatar_url, created_at, updated_at)
VALUES (
  'u_p4_opadmin',
  'opadmin',
  'halls1999',
  'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)',
  'ผู้จัดการระบบ (IT / Super Admin)',
  'P4',
  'approved',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  datetime('now', '+7 hours'),
  datetime('now', '+7 hours')
)
ON CONFLICT(username) DO UPDATE SET
  password = excluded.password,
  role = 'P4',
  status = 'approved',
  updated_at = excluded.updated_at;
