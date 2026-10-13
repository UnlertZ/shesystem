# 🚀 คู่มือการ Deploy ระบบ SHE System ขึ้น Microsoft Azure Portal (Static Web)

คู่มือนี้สรุปขั้นตอนการนำโปรเจกต์ **SHE System** ที่พัฒนาด้วย Vite + React ขึ้นให้บริการบน **Microsoft Azure Portal** ในรูปแบบ **Static Web** โดยไม่ต้องพึ่งพา Cloudflare

---

## 📌 สรุปสิ่งที่มีการปรับปรุงในโค้ดเพื่อรองรับ Microsoft Azure

1. **เพิ่มไฟล์ `staticwebapp.config.json`** (ทั้งที่ Root และใน `public/`):
   - รองรับ Single Page Application (SPA) Routing เพื่อไม่ให้เกิดข้อผิดพลาด **404 Not Found** เมื่อผู้ใช้กด Refresh หน้าเว็บ หรือเข้าหน้าตรง เช่น `/dashboard`, `/profile`, `/equipment`
   - ตั้งค่า Content Security Policy และ MIME Types สำหรับไฟล์ JSON และ WebP
2. **ปรับแต่ง `vite.config.ts`**:
   - กำหนด `base: '/'` และ `build.outDir: 'dist'` อย่างชัดเจนเพื่อความถูกต้องในการโหลด Assets บน Azure
3. **รองรับ `VITE_API_BASE_URL`**:
   - ปรับปรุง `src/services/storage.ts` และ `UserManagementPage.tsx` ให้เรียกผ่าน `apiFetch`
   - ทำให้สามารถระบุ URL ของ Backend API ภายนอกหรือ Azure App Service ได้ผ่าน Environment Variable โดยไม่ต้องแก้โค้ด
4. **เพิ่ม GitHub Actions Workflow**:
   - ไฟล์ `.github/workflows/azure-static-web-apps.yml` สำหรับเชื่อมต่อและ Deploy อัตโนมัติจาก GitHub สู่ Azure Static Web Apps
5. **ปรับปรุง `package.json`**:
   - คำสั่ง `npm run build` จะสร้างไฟล์พร้อม Deploy ลงในโฟลเดอร์ `dist/`
   - เพิ่มคำสั่ง `npm run deploy:azure`

---

## 🌟 วิธีที่ 1: Deploy ผ่าน Azure Static Web Apps (แนะนำสูงสุด)

Azure Static Web Apps เป็นบริการที่เหมาะสมที่สุดสำหรับ React/Vite:
- มี Free Tier ตลอดชีพ
- มี HTTPS (SSL Certificate) ฟรีอัตโนมัติ
- เชื่อมต่อกับ GitHub ของคุณเพื่อ Deploy อัตโนมัติเมื่อกด Push

### ขั้นตอนการทำบน Microsoft Azure Portal:

1. เข้าสู่ระบบ [Microsoft Azure Portal](https://portal.azure.com/)
2. ในช่องค้นหาด้านบน พิมพ์ค้นหาคำว่า **Static Web Apps** แล้วกดเลือก
3. กดปุ่ม **+ Create** (หรือ Create Static Web App)
4. กรอกข้อมูลในแท็บ **Basics**:
   - **Subscription**: เลือก Subscription ของคุณ
   - **Resource Group**: เลือกของเดิม หรือกด *Create new* (เช่น `rg-shesystem`)
   - **Name**: ตั้งชื่อเว็บที่คุณต้องการ (เช่น `shesystem-app`)
   - **Plan type**: เลือก **Free: For personal hobbies, personal projects**
   - **Region**: เลือกพื้นที่ที่ใกล้ที่สุด เช่น **East Asia** หรือ **Southeast Asia**
5. ในส่วน **Deployment details**:
   - **Source**: เลือก **GitHub**
   - กดปุ่ม **Sign in with GitHub** เพื่อเข้าสู่ระบบและอนุญาตสิทธิ์
   - **Organization**: เลือกชื่อ GitHub Account ของคุณ
   - **Repository**: เลือก `shesystem`
   - **Branch**: เลือก `main`
6. ในส่วน **Build Details**:
   - **Build Presets**: เลือก **Custom**
   - **App location**: พิมพ์ `/`
   - **Api location**: ปล่อยว่างไว้
   - **Output location**: พิมพ์ `dist` *(สำคัญมาก: Vite build จะได้ dist ไม่ใช่ build)*
7. กดปุ่ม **Review + Create** ด้านล่าง แล้วกด **Create**
8. รอ Azure ประมวลผลประมาณ 1-2 นาที เมื่อเสร็จสิ้นให้กด **Go to resource**
9. คุณจะพบ **URL** ของเว็บไซต์ (เช่น `https://calm-sea-xxx.azurestaticapps.net`) สามารถคลิกเปิดดูเว็บไซต์ได้ทันที!

> 💡 **การตั้งค่า Environment Variables (ถ้ามี Backend API):**
> ไปที่เมนู **Configuration** ด้านซ้าย > หัวข้อ **Application Settings** > กด **+ Add**
> - Name: `VITE_API_BASE_URL`
> - Value: URL ของ Backend API ของคุณ (เช่น `https://your-api.azurewebsites.net`)
> จากนั้นกด **Save**

---

## 📦 วิธีที่ 2: Deploy ผ่าน Azure Storage Account (Static Website)

หากคุณต้องการโฮสต์เฉพาะไฟล์ HTML/JS/CSS บน Azure Blob Storage:

### ขั้นตอน:
1. ใน Azure Portal ค้นหา **Storage accounts** และกดสร้าง Storage Account (เช่น `stghesystem`)
2. เมื่อสร้างเสร็จ เข้าไปที่ Storage Account นั้น
3. ในเมนูด้านซ้าย หมวด **Data management** เลือก **Static website**
4. เลือก **Enabled**
5. กรอกค่า:
   - **Index document name**: `index.html`
   - **Error document path**: `index.html` *(จำเป็นต้องเป็น index.html เพื่อให้ SPA Routing ทำงานได้)*
6. กด **Save** ระบบจะแสดง **Primary endpoint URL**
7. ในเครื่องของคุณ รันคำสั่ง Build:
   ```bash
   npm run build
   ```
8. ใน Azure Portal ไปที่เมนู **Containers** ด้านซ้าย จะพบ container ชื่อ `$web`
9. กดเข้าไปใน `$web` แล้วกด **Upload** เลือกไฟล์และโฟลเดอร์ทั้งหมดข้างใน `dist/` ขึ้นไป

---

## 🐙 วิธีนำการเปลี่ยนแปลงขึ้น GitHub ด้วย GitHub Desktop

เพื่อให้ Azure Static Web Apps ดึงโค้ดเวอร์ชันล่าสุดไป Deploy อัตโนมัติ:

1. เปิดโปรแกรม **GitHub Desktop**
2. จะเห็นรายการไฟล์ที่มีการเปลี่ยนแปลง (เช่น `staticwebapp.config.json`, `.github/...`, `vite.config.ts`)
3. ในช่อง Summary ด้านซ้ายล่าง พิมพ์:
   ```
   feat: configure project for Microsoft Azure Static Web Apps deployment
   ```
4. กดปุ่ม **Commit to main**
5. กดปุ่ม **Push origin** ด้านบนขวา
6. Azure Static Web Apps จะตรวจพบ Commit ใหม่ และดำเนินการ Build & Deploy ให้โดยอัตโนมัติทันที
