-- Cloudflare D1 Database Schema: d1shesystem
-- SHE (Safety, Health, and Environment) System

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
);

-- 2. Positions Table
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    default_role TEXT NOT NULL, -- 'P1', 'P2', 'P3', 'P4'
    created_at TEXT NOT NULL
);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    department TEXT NOT NULL, -- เช่น 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', 'แผนกผลิต (Production)'
    position TEXT NOT NULL,   -- เช่น 'พนักงาน', 'หัวหน้างาน', 'รองผู้จัดการ', 'ผู้จัดการ'
    role TEXT NOT NULL,       -- 'P1' (พนักงาน), 'P2' (หัวหน้า/รองผจก/ผจก), 'P3' (แอดมิน), 'P4' (ผู้จัดการระบบ), 'GUEST'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Equipment Table (EX, FHC, FH, HD)
CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,                 -- 'EX', 'FHC', 'FH', 'HD'
    code TEXT UNIQUE NOT NULL,          -- 'EX-001', 'FHC-001', etc.
    sequence_number INTEGER NOT NULL,   -- Numeric sequence for vacant slot reuse
    category TEXT,                      -- เช่น Dry Chemical (เคมีแห้ง), CO2, Foam, Clean Agent
    weight TEXT,                        -- เช่น 10 lbs, 15 lbs, 5 kg
    location TEXT NOT NULL,             -- สถานที่ติดตั้ง เช่น อาคาร A ชั้น 1 ประตูทางออก
    in_service_date TEXT,               -- วันที่เริ่มใช้งานถัง (YYYY-MM-DD)
    inspection_sheet_photo TEXT,        -- URL รูปภาพใบตรวจเช็คคู่กับถัง (Cloudflare R2)
    location_photo TEXT,                -- URL รูปสถานที่ถัง (Cloudflare R2)
    ready_status TEXT NOT NULL DEFAULT 'READY',         -- 'READY' (พร้อมใช้งาน), 'NOT_READY' (ไม่พร้อมใช้งาน)
    inspection_status TEXT NOT NULL DEFAULT 'PENDING',  -- 'INSPECTED' (ตรวจแล้ว), 'PENDING' (ยังไม่ตรวจ)
    responsible_person TEXT NOT NULL,   -- ผู้รับผิดชอบถัง
    latest_inspector TEXT,              -- ผู้ตรวจสอบล่าสุด
    latest_inspection_date TEXT,        -- วันที่ตรวจเช็คล่าสุด (ISO/Date string Thai time)
    defect_status TEXT NOT NULL DEFAULT 'NORMAL', -- 'NORMAL' (ปกติ), 'DEFECT' (พบปัญหา), 'RESOLVED' (แก้ไขแล้ว)
    defect_notes TEXT,                  -- รายละเอียดความผิดปกติ
    defect_photo TEXT,                  -- URL รูปความผิดปกติ (Cloudflare R2)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Index on equipment type and sequence number for fast lowest vacant search
CREATE INDEX IF NOT EXISTS idx_equipment_type_seq ON equipment(type, sequence_number);

-- 3. Inspections History Table
CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    inspector_id TEXT NOT NULL,
    inspector_name TEXT NOT NULL,
    inspection_date TEXT NOT NULL,       -- วันที่ตรวจเช็ค (YYYY-MM-DD or ISO string Thai time)
    ready_status TEXT NOT NULL,          -- 'READY' / 'NOT_READY'
    checklist_results TEXT NOT NULL,     -- JSON format of checklist item scores/checks
    inspection_photo TEXT,               -- R2 storage URL
    location_photo TEXT,                 -- R2 storage URL
    is_abnormal INTEGER NOT NULL DEFAULT 0, -- 1 = พบความผิดปกติ, 0 = ปกติ
    abnormal_description TEXT,          -- รายละเอียดความผิดปกติ
    defect_resolved INTEGER NOT NULL DEFAULT 0, -- 1 = แก้ไขแล้ว, 0 = ยังไม่แก้ไข
    resolved_at TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL
);

-- Index on inspections date for 3-year data retention queries & cleanup
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_inspections_equipment ON inspections(equipment_id);

-- 4. Tasks Table (Delegation & Activity Assignments)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    equipment_id TEXT REFERENCES equipment(id) ON DELETE SET NULL,
    assigned_by_id TEXT NOT NULL,
    assigned_by_name TEXT NOT NULL,
    assigned_to_id TEXT NOT NULL,
    assigned_to_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
    task_type TEXT NOT NULL DEFAULT 'INSPECTION', -- 'INSPECTION' (มอบหมายตรวจสอบ), 'ACTIVITY' (มอบหมายเข้าร่วมกิจกรรม)
    due_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_id);

-- 5. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_user_id TEXT,             -- specific user ID, or NULL for broadcast
    target_role TEXT,                    -- 'ALL', 'P1', 'P2', 'P3', 'P4'
    sender_name TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,                  -- 'SYSTEM', 'ALERT', 'DEFECT', 'PASSWORD_RESET', 'TASK'
    is_read INTEGER NOT NULL DEFAULT 0,  -- 0 = unread, 1 = read
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(recipient_user_id);

-- 6. Password Reset Requests Table
CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RESOLVED'
    requested_at TEXT NOT NULL
);

-- 7. Initial Seed Data
-- Seed Departments
INSERT OR IGNORE INTO departments (id, name, created_at) VALUES
('dept_01', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', '2025-01-01T00:00:00+07:00'),
('dept_02', 'แผนกผลิต (Production)', '2025-01-01T00:00:00+07:00'),
('dept_03', 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', '2025-01-01T00:00:00+07:00'),
('dept_04', 'แผนกวิศวกรรมและซ่อมบำรุง (Maintenance & Engineering)', '2025-01-01T00:00:00+07:00'),
('dept_05', 'แผนกทรัพยากรบุคคล (HR & Admin)', '2025-01-01T00:00:00+07:00'),
('dept_06', 'แผนกควบคุมคุณภาพ (QC / QA)', '2025-01-01T00:00:00+07:00');

-- Seed Positions
INSERT OR IGNORE INTO positions (id, name, default_role, created_at) VALUES
('pos_01', 'พนักงาน', 'P1', '2025-01-01T00:00:00+07:00'),
('pos_02', 'หัวหน้างาน', 'P2', '2025-01-01T00:00:00+07:00'),
('pos_03', 'รองผู้จัดการ', 'P2', '2025-01-01T00:00:00+07:00'),
('pos_04', 'ผู้จัดการ', 'P2', '2025-01-01T00:00:00+07:00'),
('pos_05', 'เจ้าหน้าที่ความปลอดภัย (จป.)', 'P3', '2025-01-01T00:00:00+07:00'),
('pos_06', 'ผู้จัดการระบบ (IT / Super Admin)', 'P4', '2025-01-01T00:00:00+07:00');

-- Seed Users:
-- Admin (P3): admin / admin123
-- System Manager (P4): superadmin / admin123
-- Supervisor (P2): supervisor1 / 123456
-- Staff (P1): staff1 / 123456
INSERT OR IGNORE INTO users (id, username, password, department, position, role, status, avatar_url, created_at, updated_at) VALUES
('u_p4_01', 'superadmin', 'admin123', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', 'ผู้จัดการระบบ (IT / Super Admin)', 'P4', 'approved', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00'),
('u_p3_01', 'admin', 'admin123', 'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', 'เจ้าหน้าที่ความปลอดภัย (จป.)', 'P3', 'approved', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00'),
('u_p2_01', 'supervisor1', '123456', 'แผนกผลิต (Production)', 'หัวหน้างาน', 'P2', 'approved', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00'),
('u_p1_01', 'staff1', '123456', 'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', 'พนักงาน', 'P1', 'approved', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', '2025-01-01T00:00:00+07:00', '2025-01-01T00:00:00+07:00');

-- Initial Mock Equipment, Tasks, Notifications have been removed for clean production use.

