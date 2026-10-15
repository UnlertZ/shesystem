import cron from 'node-cron';
import { query } from './db.js';
import { deleteAzureBlob } from './blobStorage.js';

const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

/**
 * Perform monthly inspection status reset and send reminder notifications
 */
export async function runMonthlyReset() {
  try {
    const now = new Date();
    // Thai Time UTC+7
    const thaiDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const month = thaiDate.getUTCMonth();
    const year = thaiDate.getUTCFullYear();
    const monthName = THAI_MONTH_NAMES[month];
    const yearBE = year + 543;
    const nowIso = thaiDate.toISOString();

    console.log(`⏰ [CRON] กำลังรันรอบรีเซ็ตประจำเดือน: ${monthName} ${yearBE}...`);

    // Reset equipment status
    await query("UPDATE dbo.equipment SET inspection_status = 'PENDING'");

    const notifMsg = `เริ่มตรวจอุปกรณ์ดับเพลิงประจำรอบเดือน${monthName} ${yearBE} ได้แล้ว`;
    const notifId = `notif_cron_${Date.now()}`;

    // Send notifications to supervisors and admins (P2, P3, P4)
    for (const role of ['P2', 'P3', 'P4']) {
      await query(`
        INSERT INTO dbo.notifications (id, recipient_user_id, target_role, sender_name, title, message, type, is_read, created_at)
        VALUES (@id, NULL, @role, @sender, @title, @message, 'REMINDER', 0, @created_at)
      `, {
        id: `${notifId}_${role}`,
        role,
        sender: 'ระบบอัตโนมัติ SHE',
        title: 'แจ้งเตือนรอบตรวจอุปกรณ์ประจำเดือน',
        message: notifMsg,
        created_at: nowIso
      });
    }

    console.log(`✅ [CRON] รีเซ็ตสถานะและส่งแจ้งเตือนรอบเดือน ${monthName} เรียบร้อยแล้ว`);
  } catch (err) {
    console.error('❌ [CRON] ข้อผิดพลาดในการรันรีเซ็ตประจำเดือน:', err.message);
  }
}

/**
 * Perform retention cleanup: Delete inspection records and photos older than 2 years
 * (Data and photos older than 2 years will be permanently purged from database and Azure Blob Storage)
 * @param {number} retentionYears - default 2 years
 */
export async function runRetentionCleanup(retentionYears = 2) {
  try {
    const now = new Date();
    const thaiDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const cutoffDateObj = new Date(thaiDate);
    cutoffDateObj.setFullYear(cutoffDateObj.getFullYear() - retentionYears);
    const cutoffDate = cutoffDateObj.toISOString();
    const cutoffDateStr = cutoffDate.split('T')[0];

    console.log(`🧹 [RETENTION] กำลังตรวจสอบและลบข้อมูลที่เก่ากว่า ${retentionYears} ปี (ก่อน ${cutoffDateStr})...`);

    let deletedPhotosCount = 0;

    // 1. Find and delete inspection photos older than 2 years
    try {
      const oldInspRes = await query(
        'SELECT id, inspection_photo, location_photo FROM dbo.inspections WHERE inspection_date < @cutoffDate',
        { cutoffDate }
      );
      const oldInspections = oldInspRes.recordset || [];
      for (const insp of oldInspections) {
        if (insp.inspection_photo) {
          await deleteAzureBlob(insp.inspection_photo);
          deletedPhotosCount++;
        }
        if (insp.location_photo) {
          await deleteAzureBlob(insp.location_photo);
          deletedPhotosCount++;
        }
      }
    } catch (photoErr) {
      console.warn('⚠️ ไม่สามารถลบรูปภาพประวัติการตรวจเก่าจาก Blob Storage:', photoErr.message);
    }

    // Delete inspection rows
    const resInsp = await query('DELETE FROM dbo.inspections WHERE inspection_date < @cutoffDate', { cutoffDate });
    const deletedInspections = resInsp.rowsAffected[0] || 0;

    // 2. Find and delete Safety Committee findings photos older than 2 years
    try {
      const oldFindingsRes = await query(
        'SELECT id, photo_url, after_photo_url FROM dbo.safety_findings WHERE created_at < @cutoffDate',
        { cutoffDate }
      );
      const oldFindings = oldFindingsRes.recordset || [];
      for (const f of oldFindings) {
        if (f.photo_url) {
          await deleteAzureBlob(f.photo_url);
          deletedPhotosCount++;
        }
        if (f.after_photo_url) {
          await deleteAzureBlob(f.after_photo_url);
          deletedPhotosCount++;
        }
      }
    } catch (findingPhotoErr) {
      console.warn('⚠️ ไม่สามารถลบรูปภาพ คปอ. เก่าจาก Blob Storage:', findingPhotoErr.message);
    }

    const resFindings = await query('DELETE FROM dbo.safety_findings WHERE created_at < @cutoffDate', { cutoffDate });
    const deletedFindings = resFindings.rowsAffected[0] || 0;

    const resPatrols = await query('DELETE FROM dbo.safety_patrols WHERE patrol_date < @cutoffDateStr', { cutoffDateStr });
    const deletedPatrols = resPatrols.rowsAffected[0] || 0;

    console.log(`✅ [RETENTION] ล้างข้อมูลเก่ากว่า ${retentionYears} ปี สำเร็จ: ลบประวัติตรวจ ${deletedInspections} แถว, ลบผล คปอ. ${deletedFindings} แถว, ลบรอบ คปอ. ${deletedPatrols} แถว, ลบไฟล์รูปภาพ ${deletedPhotosCount} ไฟล์`);

    return {
      success: true,
      cutoff_date: cutoffDate,
      deleted_inspections: deletedInspections,
      deleted_findings: deletedFindings,
      deleted_patrols: deletedPatrols,
      deleted_photos: deletedPhotosCount
    };
  } catch (err) {
    console.error('❌ [RETENTION] ข้อผิดพลาดในการลบข้อมูลเก่า 2 ปี:', err.message);
    return { success: false, error: err.message };
  }
}

export async function runYearlyCleanup() {
  return runRetentionCleanup(2);
}

/**
 * Initialize cron scheduled triggers
 * 1. Monthly Reset: Run at 00:00 on the 1st day of every month (Thai Time UTC+7)
 * 2. 2-Year Retention Purge: Runs at 02:00 on the 1st day of every month
 */
export function startScheduler() {
  // Check every hour whether it is 00:00 Thai Time on day 1
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const thaiDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const day = thaiDate.getUTCDate();
    const hour = thaiDate.getUTCHours();

    // 00:00 Thai Time on 1st of month
    if (day === 1 && hour === 0) {
      await runMonthlyReset();
    }

    // 02:00 Thai Time on 1st of month -> Run 2-year retention cleanup
    if (day === 1 && hour === 2) {
      await runRetentionCleanup(2);
    }
  });

  console.log('⏰ ระบบ Scheduler (Monthly Reset & 2-Year Retention Cleanup) เริ่มทำงานแล้ว');
}
