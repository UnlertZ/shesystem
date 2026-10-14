-- ===========================================================================
-- Azure SQL Database - Data Migration Seed Script
-- Generated at: 2026-10-14T09:42:03.205118
-- Source: 50182be149e8392332cb6574b5f2d645a8861c2561e7f88156a668fc29863c07.sqlite
-- Description: Inserts data extracted from SQLite into Azure SQL Database
-- ===========================================================================

SET NOCOUNT ON;

-- -------------------------------------------------------------
-- Data for table: departments (6 records)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.[departments] WHERE [id] = N'dept_01')
BEGIN
    INSERT INTO dbo.[departments] ([id], [name], [created_at])
    VALUES (N'dept_01', N'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[departments] WHERE [id] = N'dept_02')
BEGIN
    INSERT INTO dbo.[departments] ([id], [name], [created_at])
    VALUES (N'dept_02', N'แผนกผลิต (Production)', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[departments] WHERE [id] = N'dept_03')
BEGIN
    INSERT INTO dbo.[departments] ([id], [name], [created_at])
    VALUES (N'dept_03', N'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[departments] WHERE [id] = N'dept_04')
BEGIN
    INSERT INTO dbo.[departments] ([id], [name], [created_at])
    VALUES (N'dept_04', N'แผนกซ่อมบำรุงและวิศวกรรม (Maintenance & Engineering)', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[departments] WHERE [id] = N'dept_05')
BEGIN
    INSERT INTO dbo.[departments] ([id], [name], [created_at])
    VALUES (N'dept_05', N'แผนกทรัพยากรบุคคลและธุรการ (HR & Admin)', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[departments] WHERE [id] = N'dept_06')
BEGIN
    INSERT INTO dbo.[departments] ([id], [name], [created_at])
    VALUES (N'dept_06', N'แผนกควบคุมคุณภาพ (QC & QA)', N'2025-01-01T00:00:00+07:00');
END;

-- -------------------------------------------------------------
-- Data for table: positions (6 records)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.[positions] WHERE [id] = N'pos_01')
BEGIN
    INSERT INTO dbo.[positions] ([id], [name], [default_role], [created_at])
    VALUES (N'pos_01', N'พนักงาน', N'P1', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[positions] WHERE [id] = N'pos_02')
BEGIN
    INSERT INTO dbo.[positions] ([id], [name], [default_role], [created_at])
    VALUES (N'pos_02', N'หัวหน้างาน', N'P2', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[positions] WHERE [id] = N'pos_03')
BEGIN
    INSERT INTO dbo.[positions] ([id], [name], [default_role], [created_at])
    VALUES (N'pos_03', N'รองผู้จัดการ', N'P2', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[positions] WHERE [id] = N'pos_04')
BEGIN
    INSERT INTO dbo.[positions] ([id], [name], [default_role], [created_at])
    VALUES (N'pos_04', N'ผู้จัดการ', N'P2', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[positions] WHERE [id] = N'pos_05')
BEGIN
    INSERT INTO dbo.[positions] ([id], [name], [default_role], [created_at])
    VALUES (N'pos_05', N'เจ้าหน้าที่ความปลอดภัย (จป.)', N'P3', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[positions] WHERE [id] = N'pos_06')
BEGIN
    INSERT INTO dbo.[positions] ([id], [name], [default_role], [created_at])
    VALUES (N'pos_06', N'ผู้จัดการระบบ (IT / Super Admin)', N'P4', N'2025-01-01T00:00:00+07:00');
END;

-- -------------------------------------------------------------
-- Data for table: users (6 records)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.[users] WHERE [id] = N'u_p3_01')
BEGIN
    INSERT INTO dbo.[users] ([id], [username], [password], [department], [position], [role], [status], [avatar_url], [created_at], [updated_at])
    VALUES (N'u_p3_01', N'admin', N'admin123', N'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', N'เจ้าหน้าที่ความปลอดภัย (จป.)', N'P3', N'approved', N'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', N'2025-01-01T00:00:00+07:00', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[users] WHERE [id] = N'u_p2_01')
BEGIN
    INSERT INTO dbo.[users] ([id], [username], [password], [department], [position], [role], [status], [avatar_url], [created_at], [updated_at])
    VALUES (N'u_p2_01', N'supervisor1', N'123456', N'แผนกผลิต (Production)', N'หัวหน้างาน', N'P2', N'approved', N'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', N'2025-01-01T00:00:00+07:00', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[users] WHERE [id] = N'u_p1_01')
BEGIN
    INSERT INTO dbo.[users] ([id], [username], [password], [department], [position], [role], [status], [avatar_url], [created_at], [updated_at])
    VALUES (N'u_p1_01', N'staff1', N'123456', N'แผนกคลังสินค้าและโลจิสติกส์ (Warehouse & Logistics)', N'พนักงาน', N'P1', N'approved', N'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', N'2025-01-01T00:00:00+07:00', N'2025-01-01T00:00:00+07:00');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[users] WHERE [id] = N'u_1791470849303')
BEGIN
    INSERT INTO dbo.[users] ([id], [username], [password], [department], [position], [role], [status], [avatar_url], [created_at], [updated_at])
    VALUES (N'u_1791470849303', N'user_1791470849283', N'mypassword123', N'แผนกผลิต (Production)', N'พนักงาน', N'P1', N'pending', NULL, N'2026-10-08T14:47:29.303Z', N'2026-10-08T14:47:29.303Z');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[users] WHERE [id] = N'u_p4_opadmin')
BEGIN
    INSERT INTO dbo.[users] ([id], [username], [password], [department], [position], [role], [status], [avatar_url], [created_at], [updated_at])
    VALUES (N'u_p4_opadmin', N'opadmin', N'halls1999', N'แผนกความปลอดภัยและสิ่งแวดล้อม (SHE)', N'ผู้จัดการระบบ (IT / Super Admin)', N'P4', N'approved', N'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', N'2026-10-08T14:48:16.496Z', N'2026-10-08T14:48:16.496Z');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[users] WHERE [id] = N'u_1791470909362')
BEGIN
    INSERT INTO dbo.[users] ([id], [username], [password], [department], [position], [role], [status], [avatar_url], [created_at], [updated_at])
    VALUES (N'u_1791470909362', N'somchai_724', N'password123', N'แผนกผลิต (Production)', N'พนักงาน', N'P1', N'pending', NULL, N'2026-10-08T14:48:29.362Z', N'2026-10-08T14:48:29.362Z');
END;

-- -------------------------------------------------------------
-- Data for table: inspections (1 records)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.[inspections] WHERE [id] = N'insp_1791467007680')
BEGIN
    INSERT INTO dbo.[inspections] ([id], [equipment_id], [inspector_id], [inspector_name], [inspection_date], [ready_status], [checklist_results], [inspection_photo], [location_photo], [is_abnormal], [abnormal_description], [defect_resolved], [resolved_at], [resolved_by], [created_at])
    VALUES (N'insp_1791467007680', N'eq_ex_1791467007650', N'u_p3_01', N'admin', N'2026-10-08T13:43:27.680Z', N'READY', N'{"gauge_pressure":true,"seal_intact":true}', N'', N'', 0, N'', 0, NULL, NULL, N'2026-10-08T13:43:27.680Z');
END;

-- -------------------------------------------------------------
-- Data for table: notifications (2 records)
-- -------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.[notifications] WHERE [id] = N'notif_1791470849310')
BEGIN
    INSERT INTO dbo.[notifications] ([id], [recipient_user_id], [target_role], [sender_name], [title], [message], [type], [is_read], [created_at])
    VALUES (N'notif_1791470849310', NULL, N'P3', N'ระบบสมัครสมาชิก', N'มีสมาชิกรอการอนุมัติ', N'ผู้ใช้ user_1791470849283 (แผนกผลิต (Production) - พนักงาน) สมัครสมาชิกเข้าสู่ระบบ รอการอนุมัติ', N'SYSTEM', 0, N'2026-10-08T14:47:29.303Z');
END;
IF NOT EXISTS (SELECT 1 FROM dbo.[notifications] WHERE [id] = N'notif_1791470909365')
BEGIN
    INSERT INTO dbo.[notifications] ([id], [recipient_user_id], [target_role], [sender_name], [title], [message], [type], [is_read], [created_at])
    VALUES (N'notif_1791470909365', NULL, N'P3', N'ระบบสมัครสมาชิก', N'มีสมาชิกรอการอนุมัติ', N'ผู้ใช้ somchai_724 (แผนกผลิต (Production) - พนักงาน) สมัครสมาชิกเข้าสู่ระบบ รอการอนุมัติ', N'SYSTEM', 0, N'2026-10-08T14:48:29.362Z');
END;
