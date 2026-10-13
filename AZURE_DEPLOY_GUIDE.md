# 🚀 คู่มือการ Deploy ระบบ SHE System บน Microsoft Azure (เชื่อมต่อ Cloudflare D1 & R2)

คู่มือนี้อธิบายสถาปัตยกรรมและการ Deploy ระบบ **SHE System** โดยใช้ **Microsoft Azure Portal (Azure Static Web Apps)** สำหรับโฮสต์หน้าเว็บ Frontend และเชื่อมต่อฐานข้อมูล **Cloudflare D1 (`d1shesystem`)** รวมถึงที่เก็บไฟล์รูปภาพ **Cloudflare R2 (`r2shesystem`)** ผ่าน Cloudflare Worker Backend อย่างสมบูรณ์

---

## 🏛️ โครงสร้างสถาปัตยกรรมระบบ (Hybrid Architecture)

```
[ ผู้ใช้งาน (Browser) ]
       │
       ▼
┌──────────────────────────────────────────────┐
│  Microsoft Azure Static Web Apps (Frontend)  │
│  - โฮสต์ไฟล์ React 19 + Vite + Tailwind      │
│  - มี SSL Certificate ฟรี และโหลดเร็วทั่วโลก │
│  - รองรับ SPA Routing ไม่ติด 404              │
└──────────────────────┬───────────────────────┘
                       │ เรียก API ผ่าน HTTPS
                       ▼
┌──────────────────────────────────────────────┐
│  Cloudflare Worker API (Backend)             │
│  - URL: https://shesystem.anuruk3030.workers.dev
│  - รองรับ CORS ทุกโดเมน                      │
│  - รัน Cron Jobs รายเดือนและรายปี            │
└──────────────┬────────────────┬──────────────┘
               │                │
               ▼                ▼
┌──────────────────────┐ ┌──────────────────────┐
│  Cloudflare D1       │ │  Cloudflare R2       │
│  (Database)          │ │  (Photo Storage)     │
│  - ข้อมูลอุปกรณ์ 156 ตัว│ │  - รูปใบตรวจ/สถานที่  │
│  - ข้อมูลสมาชิก/สิทธิ์│ │  - รูปจุดชำรุดแก้ไข   │
└──────────────────────┘ └──────────────────────┘
```

---

## 📌 สรุปการตั้งค่าการเชื่อมต่อ D1 และ R2

1. **ระบบชี้ไปยัง Cloudflare Worker ให้อัตโนมัติ**:
   - ใน [`src/services/storage.ts`](file:///c:/Users/anuru/OneDrive/Documents/Antigravity/shesystem/shesystem/src/services/storage.ts) มีการกำหนดค่าเริ่มต้นในโหมด Production ให้เชื่อมต่อไปยัง `https://shesystem.anuruk3030.workers.dev` โดยตรง
   - ดึงและบันทึกข้อมูลทุกอย่าง (Users, Equipment, Inspections, Tasks, Safety Patrols) ลงใน Cloudflare D1
   - อัปโหลดรูปภาพทั้งหมดผ่าน `/api/upload` ขึ้น Cloudflare R2 โดยอัตโนมัติ
2. **แปลง URL รูปภาพให้เป็นลิงก์สมบูรณ์**:
   - ปรับปรุงให้แปลง Path รูปภาพที่เป็น `/api/images/...` ให้กลายเป็น `https://shesystem.anuruk3030.workers.dev/api/images/...` เสมอ ทำให้รูปภาพใน R2 แสดงผลบน Azure ได้ 100% ไม่มีภาพขาดหาย
3. **กำหนดค่าใน CI/CD Workflow**:
   - ในไฟล์ [`.github/workflows/azure-static-web-apps-white-rock-0c7f52c10.yml`](file:///c:/Users/anuru/OneDrive/Documents/Antigravity/shesystem/shesystem/.github/workflows/azure-static-web-apps-white-rock-0c7f52c10.yml) กำหนด `VITE_API_BASE_URL` เป็น `https://shesystem.anuruk3030.workers.dev` เป็นค่าเริ่มต้น

---

## 🐙 วิธีนำการเปลี่ยนแปลงขึ้นระบบผ่าน GitHub Desktop

1. เปิดโปรแกรม **GitHub Desktop**
2. จะเห็นไฟล์ที่แก้ไข:
   - `.github/workflows/azure-static-web-apps-white-rock-0c7f52c10.yml`
   - `src/services/storage.ts`
   - `.env.example`
   - `AZURE_DEPLOY_GUIDE.md`
3. ในช่อง Summary พิมพ์:
   ```text
   feat: connect Azure Static Web Apps frontend to Cloudflare D1 and R2
   ```
4. กดปุ่ม **Commit to main**
5. กดปุ่ม **Push origin**
6. GitHub Actions จะทำการ Build และ Deploy ขึ้น Azure อัตโนมัติ โดยตัวเว็บที่อยู่บน Azure จะดึงข้อมูลจาก Cloudflare D1 และ R2 ทันที!
