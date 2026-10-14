import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getPool, query, initSchema } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TABLES = [
  'departments',
  'positions',
  'users',
  'equipment',
  'inspections',
  'tasks',
  'notifications',
  'user_dismissed_notifications',
  'password_resets',
  'safety_patrols',
  'safety_findings'
];

async function runMigration() {
  console.log('============================================================');
  console.log('🚀 เริ่มกระบวนการย้ายข้อมูลจาก SQLite สู่ Azure SQL Database');
  console.log('============================================================\n');

  // 1. Ensure dump exists
  const dumpPath = path.join(__dirname, 'sqlite_dump.json');
  if (!fs.existsSync(dumpPath)) {
    console.log('🔍 ไม่พบไฟล์ sqlite_dump.json กำลังดึงข้อมูลจาก SQLite อัตโนมัติ...');
    const pythonScript = path.join(__dirname, 'export-to-azure-sql.py');
    try {
      execSync(`python "${pythonScript}"`, { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ ไม่สามารถดึงข้อมูลจาก SQLite ได้:', err.message);
      process.exit(1);
    }
  }

  const rawData = fs.readFileSync(dumpPath, 'utf-8');
  const dbData = JSON.parse(rawData);

  // 2. Connect to Azure SQL and initialize schema
  console.log('\n📡 กำลังเชื่อมต่อกับ Azure SQL Database...');
  await getPool();
  console.log('🔄 ตรวจสอบและสร้างโครงสร้างตาราง (Schema)...');
  await initSchema();

  const report = [];

  // 3. Migrate each table
  for (const table of TABLES) {
    const rows = dbData[table] || [];
    console.log(`\n📦 กำลังย้ายตาราง: [${table}] (${rows.length} รายการ)...`);

    if (rows.length === 0) {
      report.push({ table, sourceRows: 0, insertedRows: 0, status: 'EMPTY' });
      continue;
    }

    let inserted = 0;
    const columns = Object.keys(rows[0]);
    const pkCol = columns.includes('id') ? 'id' : columns[0];

    for (const row of rows) {
      try {
        const pkVal = row[pkCol];
        const checkRes = await query(`SELECT TOP 1 [${pkCol}] FROM dbo.[${table}] WHERE [${pkCol}] = @pkVal`, { pkVal });

        if (checkRes.recordset && checkRes.recordset.length > 0) {
          // Already exists
          continue;
        }

        const colNames = columns.map((c) => `[${c}]`).join(', ');
        const paramPlaceholders = columns.map((c) => `@${c}`).join(', ');

        const insertQuery = `INSERT INTO dbo.[${table}] (${colNames}) VALUES (${paramPlaceholders})`;
        const params = {};
        for (const c of columns) {
          params[c] = row[c] !== undefined ? row[c] : null;
        }

        await query(insertQuery, params);
        inserted++;
      } catch (err) {
        console.error(`  ⚠️ ข้อผิดพลาดในการบันทึกแถวใน ${table} (ID: ${row[pkCol]}):`, err.message);
      }
    }

    // Verify row count in Azure SQL
    const countRes = await query(`SELECT COUNT(*) as total FROM dbo.[${table}]`);
    const totalInDb = countRes.recordset?.[0]?.total || 0;

    console.log(`  ✅ ตาราง [${table}]: นำเข้าใหม่ ${inserted} รายการ (รวมในฐานข้อมูล ${totalInDb} รายการ)`);
    report.push({
      table,
      sourceRows: rows.length,
      insertedRows: inserted,
      totalInAzure: totalInDb,
      status: 'SUCCESS'
    });
  }

  console.log('\n============================================================');
  console.log('📊 สรุปผลการย้ายข้อมูล (Migration Report)');
  console.log('============================================================');
  console.table(report);
  console.log('✨ การย้ายข้อมูลจาก SQLite สู่ Azure SQL Database สำเร็จเรียบร้อยแล้ว!\n');
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('\n❌ การย้ายข้อมูลล้มเหลว:', err);
  process.exit(1);
});
