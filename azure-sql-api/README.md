# 🚀 SHE System - Azure SQL Database API & SQLite Migration Tool

โฟลเดอร์นี้เป็นระบบ **REST API สำหรับ Microsoft Azure SQL Database** และ **เครื่องมือย้ายข้อมูล (Migration Tool) จาก SQLite เดิม สู่ Azure SQL ใหม่** โดยถูกสร้างแยกเป็นโฟลเดอร์ใหม่ทั้งหมดอย่างอิสระ ไม่มีการดัดแปลงหรือแก้ไขไฟล์เดิมของระบบใดๆ ทั้งสิ้น

---

## 🏛️ สถาปัตยกรรมระบบ (Architecture)

```
┌──────────────────────────────────────┐
│  SHE System Frontend (React / Vite)  │
│  - Azure Static Web Apps             │
└──────────────────┬───────────────────┘
                   │ เรียก API ผ่าน HTTPS
                   ▼
┌──────────────────────────────────────┐
│  Azure SQL REST API (Node.js/Express)│
│  - พอร์ตเริ่มต้น: 8787                 │
│  - จัดการ Connection Pool, Multer    │
│  - รัน Cron ประจำเดือนและตัดรอบ 2 ปี   │
└──────────────────┬───────────────────┘
                   │ T-SQL (Port 1433, Encrypted)
                   ▼
┌──────────────────────────────────────┐
│   Microsoft Azure SQL Database       │
│   (Server: xxx.database.windows.net) │
│   - ตารางทั้งหมด 11 ตาราง             │
│   - รองรับภาษาไทย (NVARCHAR)          │
└──────────────────────────────────────┘
```

---

## 📁 โครงสร้างภายในโฟลเดอร์ `azure-sql-api`

```text
azure-sql-api/
├── .env.example                     # ไฟล์ตัวอย่างตั้งค่าการเชื่อมต่อ Azure SQL
├── package.json                     # รายการ Dependencies สำหรับ API และ Migration
├── README.md                        # คู่มือการใช้งานและตั้งค่าอย่างละเอียด
├── src/
│   ├── db.js                        # โมดูลจัดการ Connection Pool กับ Azure SQL (mssql)
│   ├── schema.sql                   # โครงสร้างตาราง T-SQL ทั้งหมด 11 ตาราง (สำหรับ Azure)
│   ├── scheduler.js                 # ระบบ Cron อัตโนมัติ (รีเซ็ตรอบตรวจรายเดือน & เคลียร์ข้อมูล 2 ปี)
│   └── server.js                    # REST API Server จำลอง Endpoints เดิมครบถ้วน 100%
├── migrate/
│   ├── export-to-azure-sql.py       # สคริปต์ Python ดึงข้อมูลจาก SQLite เป็น T-SQL & JSON
│   ├── export-to-azure-sql.js       # สคริปต์ Node.js ดึงข้อมูล
│   ├── migrate.js                   # สคริปต์ Node.js ย้ายข้อมูลขึ้น Azure SQL อัตโนมัติ
│   ├── azure_data_seed.sql          # ไฟล์ SQL สำเร็จรูป นำไปวางและกดรันใน Query Editor บน Azure Portal ได้ทันที
│   └── sqlite_dump.json             # ข้อมูลดิบที่ดึงมาจาก SQLite ในรูปแบบ JSON
└── uploads/                         # โฟลเดอร์เก็บไฟล์รูปภาพที่อัปโหลด
```

---

## 🛠️ ขั้นตอนที่ 1: การสร้างและตั้งค่า Azure SQL บน Microsoft Azure Portal

1. **เข้าสู่ระบบ Microsoft Azure Portal** (https://portal.azure.com)
2. ค้นหาบริการ **SQL Database** และกด **+ Create**
3. กำหนดค่าพื้นฐาน:
   - **Subscription**: เลือก Subscription ของคุณ
   - **Resource group**: เลือกหรือสร้างใหม่ (เช่น `rg-shesystem`)
   - **Database name**: ตั้งชื่อเป็น `shesystem`
   - **Server**: หากยังไม่มี ให้กด *Create new*
     - ตั้งชื่อ Server เช่น `shesystem-server`
     - Authentication: เลือก *SQL authentication* หรือ *Azure AD and SQL authentication*
     - ตั้งชื่อ **Server admin login**: เช่น `cloudadmin`
     - ตั้ง **Password**: กำหนดรหัสผ่านที่มีความปลอดภัย
4. **Compute + storage**:
   - เลือก **Basic** หรือ **General Purpose (Serverless)** เพื่อประหยัดค่าใช้จ่าย
5. **Networking (สำคัญมาก)**:
   - ติ๊กถูกที่: **"Allow Azure services and resources to access this server"** (เพื่อให้ API และ App Service เชื่อมต่อได้)
   - กด **"Add current client IP address"** (เพื่อให้เครื่องคอมพิวเตอร์ของคุณต่อเชื่อมและย้ายข้อมูลได้)
6. กด **Review + create** แล้วกด **Create**

---

## 📦 ขั้นตอนที่ 2: การย้ายข้อมูลจาก SQLite เก่าย้ายมาสู่ Azure SQL Database ใหม่

คุณสามารถเลือกวิธีย้ายข้อมูลได้ **2 วิธี** ตามความสะดวก:

### 🌟 วิธีที่ 1: นำเข้าผ่าน Azure Portal Query Editor (ง่ายที่สุด ไม่ต้องลงโปรแกรมเพิ่ม)

1. ในหน้า Azure Portal เปิดไปที่ **SQL Database** (`shesystem`) ที่สร้างไว้
2. เมนูด้านซ้าย เลือก **Query editor (preview)**
3. ล็อกอินด้วยชื่อและรหัสผ่าน Admin ที่ตั้งไว้
4. **สร้างตาราง**:
   - เปิดไฟล์ [`src/schema.sql`](file:///c:/Users/anuru/OneDrive/Documents/Antigravity/shesystem/shesystem/azure-sql-api/src/schema.sql)
   - คัดลอกโค้ดทั้งหมดไปวางในช่อง Query Editor แล้วกดปุ่ม **Run**
5. **นำเข้าข้อมูลจาก SQLite**:
   - เปิดไฟล์ [`migrate/azure_data_seed.sql`](file:///c:/Users/anuru/OneDrive/Documents/Antigravity/shesystem/shesystem/azure-sql-api/migrate/azure_data_seed.sql) (ซึ่งถูกดึงจาก SQLite ปัจจุบันเตรียมไว้ให้แล้ว)
   - คัดลอกโค้ดทั้งหมดไปวางใน Query Editor แล้วกดปุ่ม **Run**
6. ข้อมูลทั้งหมด (Users, Departments, Positions, Inspections, Notifications) จะถูกนำเข้าไปยัง Azure SQL Database ทันที!

---

### 💻 วิธีที่ 2: รัน Migration ผ่านคำสั่ง Node.js อัตโนมัติ

1. เข้าไปยังโฟลเดอร์ `azure-sql-api`:
   ```powershell
   cd azure-sql-api
   ```
2. ติดตั้ง Dependencies:
   ```powershell
   npm install
   ```
3. สร้างไฟล์ `.env` โดยคัดลอกมาจาก `.env.example`:
   ```powershell
   Copy-Item .env.example .env
   ```
4. แก้ไขข้อมูลใน `.env` ให้ตรงกับ Azure SQL Server ของคุณ:
   ```env
   AZURE_SQL_SERVER=shesystem-server.database.windows.net
   AZURE_SQL_DATABASE=shesystem
   AZURE_SQL_USER=cloudadmin
   AZURE_SQL_PASSWORD=YourPassword123!
   ```
   *(หรือใส่ `AZURE_SQL_CONNECTION_STRING` แบบเต็มเส้นเดียวจาก Azure Portal ก็ได้)*

5. รันคำสั่งย้ายข้อมูล:
   ```powershell
   npm run migrate
   ```
   ระบบจะตรวจสอบโครงสร้างตาราง ดึงข้อมูลจาก SQLite และบันทึกเข้า Azure SQL พร้อมแสดงตารางสรุปผลอย่างละเอียด

---

## ⚡ ขั้นตอนที่ 3: การเริ่มต้นและทดสอบ API Server

1. รันเซิร์ฟเวอร์:
   ```powershell
   npm start
   ```
2. ทดสอบความพร้อมของ API และการเชื่อมต่อ Azure SQL:
   - เปิดบราวเซอร์ไปที่: `http://localhost:8787/api/health`
   - จะได้รับผลลัพธ์:
     ```json
     {
       "status": "ok",
       "service": "shesystem-azure-sql-api",
       "database": "Azure SQL Database",
       "db_alive": true,
       "timestamp": "2026-10-14T..."
     }
     ```

---

## 🌐 การเชื่อมต่อกับ Frontend (SHE System)

หากต้องการให้หน้าเว็บหลักเรียกใช้ Azure SQL API นี้:
- ในโฟลเดอร์โปรเจกต์หลัก ให้ตั้งค่าในไฟล์ `.env`:
  ```env
  VITE_API_BASE_URL=http://localhost:8787
  ```
  *(หรือเมื่อนำขึ้น Azure App Service ให้ใส่ URL ของ App Service เช่น `https://shesystem-api.azurewebsites.net`)*
- เมื่อเปิดใช้งาน Frontend ระบบจะดึงและบันทึกข้อมูลทุกอย่างลงบน **Azure SQL Database** โดยตรง

---

## 📋 รายการ API Endpoints ทั้งหมดที่รองรับ

| หมวดหมู่ | Method | Path | รายละเอียด |
| :--- | :--- | :--- | :--- |
| **System** | `GET` | `/api/health` | ตรวจสอบสถานะการเชื่อมต่อ Azure SQL |
| **Auth** | `POST` | `/api/auth/login` | เข้าสู่ระบบ (Case-insensitive) |
| | `POST` | `/api/auth/register` | สมัครสมาชิก (Default P1 + แจ้งเตือน P3) |
| | `POST` | `/api/auth/forgot-password` | คำขอรีเซ็ตรหัสผ่าน |
| **Users** | `GET` | `/api/users` | รายชื่อผู้ใช้ทั้งหมด |
| | `POST` | `/api/users` | เพิ่มผู้ใช้ใหม่ |
| | `PUT` | `/api/users/:id` | แก้ไขข้อมูลผู้ใช้ |
| | `PUT` | `/api/users/:id/safety-committee` | แต่งตั้ง/ปลด คณะกรรมการ คปอ. |
| | `POST` | `/api/users/:id/approve` | อนุมัติผู้ใช้ |
| | `POST` | `/api/users/:id/reset-password` | รีเซ็ตรหัสเป็น 0000 |
| | `POST` | `/api/users/:id/change-password` | เปลี่ยนรหัสผ่าน |
| | `POST` | `/api/users/:id/request-name-change`| ส่งคำขอเปลี่ยนชื่อ |
| | `POST` | `/api/users/:id/approve-name-change`| อนุมัติ/ปฏิเสธการเปลี่ยนชื่อ |
| | `DELETE`| `/api/users/:id` | ลบผู้ใช้ |
| **Departments** | `GET/POST/PUT/DELETE` | `/api/departments` | จัดการข้อมูลแผนก |
| **Positions** | `GET/POST/PUT/DELETE` | `/api/positions` | จัดการข้อมูลตำแหน่ง/ระดับ |
| **Equipment** | `GET` | `/api/equipment` | ดึงรายการถัง/อุปกรณ์ |
| | `POST` | `/api/equipment` | เพิ่มอุปกรณ์ (คำนวณลำดับว่างอัตโนมัติ) |
| | `POST` | `/api/equipment/bulk` | นำเข้าอุปกรณ์จำนวนมาก (Bulk) |
| | `PUT` | `/api/equipment/:id` | แก้ไขข้อมูลอุปกรณ์ |
| | `DELETE`| `/api/equipment/:id` | ลบอุปกรณ์ (คืนเลขรหัสว่าง) |
| | `POST` | `/api/equipment/:id/resolve-defect` | บันทึกแก้ไขจุดบกพร่องถัง |
| **Inspections** | `GET` | `/api/inspections` | ดึงประวัติการตรวจเช็ค |
| | `POST` | `/api/inspections` | บันทึกผลการตรวจ (อัปเดตสถานะถัง & งาน) |
| **Tasks** | `GET/POST/PATCH/DELETE` | `/api/tasks` | จัดการมอบหมายงานตรวจสอบและกิจกรรม |
| **Notifications** | `GET/POST/DELETE` | `/api/notifications` | ระบบแจ้งเตือนรายบุคคลและส่วนกลาง |
| **Patrols** | `GET/POST/PUT/DELETE` | `/api/safety-patrols` | รอบการเดินตรวจความปลอดภัย คปอ. |
| **Findings** | `GET/POST/PUT/DELETE` | `/api/safety-findings` | ข้อเสนอแนะ/ชมเชย พร้อมระบบ Before-After |
| **Uploads** | `POST` | `/api/upload` | อัปโหลดรูปภาพ |
| | `GET` | `/api/images/*` | แสดงผลรูปภาพ |
| **Cron** | `POST` | `/api/cron/monthly-reset` | รันรีเซ็ตประจำเดือนแบบแมนนวล |
| | `POST` | `/api/cron/yearly-cleanup` | รันลบข้อมูลเก่ากว่า 2 ปีแบบแมนนวล |
