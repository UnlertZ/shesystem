import cron from 'node-cron';
import { query } from './db.js';

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
 * Perform yearly cleanup: Delete inspections older than 2 years
 */
export async function runYearlyCleanup() {
  try {
    const now = new Date();
    const thaiDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const cutoffYear = thaiDate.getUTCFullYear() - 2;
    const cutoffDate = `${cutoffYear}-01-01T00:00:00`;

    console.log(`🧹 [CRON] กำลังลบข้อมูลประวัติการตรวจเช็คที่เก่ากว่า 2 ปี (ก่อน ${cutoffDate})...`);
    const res = await query('DELETE FROM dbo.inspections WHERE inspection_date < @cutoffDate', { cutoffDate });
    console.log(`✅ [CRON] ลบข้อมูลเก่าเรียบร้อยแล้ว (${res.rowsAffected[0] || 0} แถว)`);
  } catch (err) {
    console.error('❌ [CRON] ข้อผิดพลาดในการลบข้อมูลเก่า:', err.message);
  }
}

/**
 * Initialize cron scheduled triggers
 * 1. Monthly Reset: Run at 00:00 on the 1st day of every month (Thai Time UTC+7 = 17:00 UTC previous day)
 * 2. Yearly Cleanup: Run on January 1st at 00:00 (Thai Time)
 */
export function startScheduler() {
  // Check every hour whether it is 00:00 Thai Time on day 1
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    const thaiDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const day = thaiDate.getUTCDate();
    const hour = thaiDate.getUTCHours();
    const month = thaiDate.getUTCMonth();

    // 00:00 Thai Time on 1st of month
    if (day === 1 && hour === 0) {
      await runMonthlyReset();

      // Jan 1st yearly cleanup
      if (month === 0) {
        await runYearlyCleanup();
      }
    }
  });

  console.log('⏰ ระบบ Scheduler (Monthly Reset & Retention Cleanup) เริ่มทำงานแล้ว');
}
