-- ===========================================================================
-- Azure SQL Database Schema: shesystem
-- Microsoft Azure Portal / Azure SQL Database (T-SQL)
-- ===========================================================================

-- 1. Departments Table (แผนก)
IF OBJECT_ID('dbo.departments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.departments (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        name NVARCHAR(255) NOT NULL UNIQUE,
        created_at NVARCHAR(50) NOT NULL
    );
END;

-- 2. Positions Table (ระดับ / ตำแหน่ง)
IF OBJECT_ID('dbo.positions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.positions (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        name NVARCHAR(255) NOT NULL UNIQUE,
        default_role VARCHAR(20) NOT NULL, -- 'P1', 'P2', 'P3', 'P4'
        created_at NVARCHAR(50) NOT NULL
    );
END;

-- 3. Users Table (ผู้ใช้งานและสิทธิ์)
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(255) NULL DEFAULT N'',
        pending_full_name NVARCHAR(255) NULL,
        department NVARCHAR(255) NOT NULL,
        position NVARCHAR(255) NOT NULL DEFAULT N'',
        role VARCHAR(20) NOT NULL, -- 'P1', 'P2', 'P3', 'P4', 'GUEST'
        status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        is_safety_committee BIT NOT NULL DEFAULT 0, -- 1 = เป็น คปอ, 0 = ไม่ได้เป็น
        avatar_url NVARCHAR(MAX) NULL,
        created_at NVARCHAR(50) NOT NULL,
        updated_at NVARCHAR(50) NOT NULL
    );
END;

-- Ensure indexes on users
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_users_username_lower' AND object_id = OBJECT_ID('dbo.users'))
BEGIN
    CREATE INDEX idx_users_username_lower ON dbo.users (username);
END;

-- 4. Equipment Table (EX, FHC, FH, HD)
IF OBJECT_ID('dbo.equipment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.equipment (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,                 -- 'EX', 'FHC', 'FH', 'HD'
        code VARCHAR(50) NOT NULL UNIQUE,          -- 'EX-001', 'FHC-001', etc.
        sequence_number INT NOT NULL,              -- Numeric sequence for vacant slot reuse
        category NVARCHAR(100) NULL,               -- เคมีแห้ง, CO2, Foam, Clean Agent
        weight NVARCHAR(50) NULL,                  -- 10 lbs, 15 lbs, 5 kg
        location NVARCHAR(255) NOT NULL,           -- สถานที่ติดตั้ง
        in_service_date NVARCHAR(50) NULL,         -- วันที่เริ่มใช้งาน (YYYY-MM-DD)
        inspection_sheet_photo NVARCHAR(MAX) NULL, -- URL รูปภาพใบตรวจ
        location_photo NVARCHAR(MAX) NULL,         -- URL รูปสถานที่ถัง
        ready_status VARCHAR(50) NOT NULL DEFAULT 'READY',        -- 'READY', 'NOT_READY'
        inspection_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'INSPECTED', 'PENDING'
        responsible_person NVARCHAR(255) NOT NULL,  -- ผู้รับผิดชอบถัง
        latest_inspector NVARCHAR(255) NULL,       -- ผู้ตรวจสอบล่าสุด
        latest_inspection_date NVARCHAR(50) NULL,  -- วันที่ตรวจเช็คล่าสุด
        defect_status VARCHAR(50) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'DEFECT', 'RESOLVED'
        defect_notes NVARCHAR(MAX) NULL,           -- รายละเอียดความผิดปกติ
        defect_photo NVARCHAR(MAX) NULL,           -- URL รูปความผิดปกติ
        created_at NVARCHAR(50) NOT NULL,
        updated_at NVARCHAR(50) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_equipment_type_seq' AND object_id = OBJECT_ID('dbo.equipment'))
BEGIN
    CREATE INDEX idx_equipment_type_seq ON dbo.equipment (type, sequence_number);
END;

-- 5. Inspections History Table (ประวัติการตรวจเช็ค)
IF OBJECT_ID('dbo.inspections', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.inspections (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        equipment_id VARCHAR(50) NOT NULL,
        inspector_id VARCHAR(50) NOT NULL,
        inspector_name NVARCHAR(255) NOT NULL,
        inspection_date NVARCHAR(50) NOT NULL,
        ready_status VARCHAR(50) NOT NULL,         -- 'READY', 'NOT_READY'
        checklist_results NVARCHAR(MAX) NOT NULL,  -- JSON string of checklist results
        inspection_photo NVARCHAR(MAX) NULL,
        location_photo NVARCHAR(MAX) NULL,
        is_abnormal BIT NOT NULL DEFAULT 0,        -- 1 = พบปัญหา, 0 = ปกติ
        abnormal_description NVARCHAR(MAX) NULL,
        defect_resolved BIT NOT NULL DEFAULT 0,
        resolved_at NVARCHAR(50) NULL,
        resolved_by NVARCHAR(255) NULL,
        created_at NVARCHAR(50) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_inspections_equipment' AND object_id = OBJECT_ID('dbo.inspections'))
BEGIN
    CREATE INDEX idx_inspections_equipment ON dbo.inspections (equipment_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_inspections_date' AND object_id = OBJECT_ID('dbo.inspections'))
BEGIN
    CREATE INDEX idx_inspections_date ON dbo.inspections (inspection_date);
END;

-- 6. Tasks Table (การมอบหมายงาน)
IF OBJECT_ID('dbo.tasks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tasks (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NULL,
        equipment_id VARCHAR(50) NULL,
        assigned_by_id VARCHAR(50) NOT NULL,
        assigned_by_name NVARCHAR(255) NOT NULL,
        assigned_to_id VARCHAR(50) NOT NULL,
        assigned_to_name NVARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_PROGRESS', 'COMPLETED'
        task_type VARCHAR(50) NOT NULL DEFAULT 'INSPECTION', -- 'INSPECTION', 'ACTIVITY'
        due_date NVARCHAR(50) NULL,
        completed_at NVARCHAR(50) NULL,
        completion_notes NVARCHAR(MAX) NULL,
        created_at NVARCHAR(50) NOT NULL,
        updated_at NVARCHAR(50) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_tasks_assigned_to' AND object_id = OBJECT_ID('dbo.tasks'))
BEGIN
    CREATE INDEX idx_tasks_assigned_to ON dbo.tasks (assigned_to_id);
END;

-- 7. Notifications Table (การแจ้งเตือน)
IF OBJECT_ID('dbo.notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.notifications (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        recipient_user_id VARCHAR(50) NULL,       -- specific user ID, or NULL for broadcast
        target_role VARCHAR(20) NULL,             -- 'ALL', 'P1', 'P2', 'P3', 'P4'
        sender_name NVARCHAR(255) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        type VARCHAR(50) NOT NULL,                -- 'SYSTEM', 'ALERT', 'DEFECT', 'PASSWORD_RESET', 'TASK', 'REMINDER'
        is_read BIT NOT NULL DEFAULT 0,
        created_at NVARCHAR(50) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_notif_recipient' AND object_id = OBJECT_ID('dbo.notifications'))
BEGIN
    CREATE INDEX idx_notif_recipient ON dbo.notifications (recipient_user_id);
END;

-- 8. User Dismissed Notifications (การปิดแจ้งเตือนเฉพาะบุคคล)
IF OBJECT_ID('dbo.user_dismissed_notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_dismissed_notifications (
        user_id VARCHAR(50) NOT NULL,
        notification_id VARCHAR(50) NOT NULL,
        dismissed_at NVARCHAR(50) NOT NULL,
        PRIMARY KEY (user_id, notification_id)
    );
END;

-- 9. Password Reset Requests Table (คำขอรีเซ็ตรหัสผ่าน)
IF OBJECT_ID('dbo.password_resets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_resets (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        username NVARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'RESOLVED'
        requested_at NVARCHAR(50) NOT NULL
    );
END;

-- 10. Safety Patrols (รอบการเดินตรวจ คปอ.)
IF OBJECT_ID('dbo.safety_patrols', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.safety_patrols (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        patrol_date NVARCHAR(50) NOT NULL,          -- YYYY-MM-DD
        start_time NVARCHAR(20) NOT NULL,           -- e.g. '10:00'
        end_time NVARCHAR(20) NOT NULL,             -- e.g. '11:00'
        time_range NVARCHAR(50) NOT NULL,           -- e.g. '10:00น.-11:00น.'
        location NVARCHAR(255) NULL,
        description NVARCHAR(MAX) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
        created_by_id VARCHAR(50) NOT NULL,
        created_by_name NVARCHAR(255) NOT NULL,
        created_at NVARCHAR(50) NOT NULL,
        updated_at NVARCHAR(50) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_patrols_date' AND object_id = OBJECT_ID('dbo.safety_patrols'))
BEGIN
    CREATE INDEX idx_patrols_date ON dbo.safety_patrols (patrol_date);
END;

-- 11. Safety Findings (รายการบันทึกผลการเดิน คปอ: แนะนำ & ชมเชย พร้อม Before-After)
IF OBJECT_ID('dbo.safety_findings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.safety_findings (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        patrol_id VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,             -- 'RECOMMEND', 'COMMEND'
        sub_type VARCHAR(50) NULL,                 -- 'NEAR_MISS', 'ACCIDENT', 'UNSAFE_CONDITION', 'UNSAFE_ACT', 'GOOD_PRACTICE'
        location NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        recommendation NVARCHAR(MAX) NULL,
        photo_url NVARCHAR(MAX) NOT NULL,          -- Before photo / Commend photo
        reporter_id VARCHAR(50) NOT NULL,
        reporter_name NVARCHAR(255) NOT NULL,
        reporter_department NVARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING_ACTION', -- 'PENDING_ACTION', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'COMMENDED'
        after_photo_url NVARCHAR(MAX) NULL,        -- After photo
        action_taken NVARCHAR(MAX) NULL,
        resolved_by_id VARCHAR(50) NULL,
        resolved_by_name NVARCHAR(255) NULL,
        resolved_at NVARCHAR(50) NULL,
        reviewed_by_id VARCHAR(50) NULL,
        reviewed_by_name NVARCHAR(255) NULL,
        reviewed_at NVARCHAR(50) NULL,
        reject_reason NVARCHAR(MAX) NULL,
        created_at NVARCHAR(50) NOT NULL,
        updated_at NVARCHAR(50) NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_findings_patrol' AND object_id = OBJECT_ID('dbo.safety_findings'))
BEGIN
    CREATE INDEX idx_findings_patrol ON dbo.safety_findings (patrol_id);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_findings_status' AND object_id = OBJECT_ID('dbo.safety_findings'))
BEGIN
    CREATE INDEX idx_findings_status ON dbo.safety_findings (status);
END;
