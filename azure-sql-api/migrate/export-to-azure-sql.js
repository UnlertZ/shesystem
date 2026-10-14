import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 กำลังรันตัวส่งออกข้อมูล SQLite เป็น Azure SQL Script...');
const pythonScript = path.join(__dirname, 'export-to-azure-sql.py');
try {
  execSync(`python "${pythonScript}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ ไม่สามารถเรียก export-to-azure-sql.py ได้:', err.message);
  process.exit(1);
}
