import { spawn } from 'child_process';

console.log('🚀 กำลังเริ่มระบบ SHE System (Backend Worker + Frontend Vite)...');

// 1. Start Wrangler Worker Backend on port 8787
const wrangler = spawn('npx', ['wrangler', 'dev', '--port', '8787'], {
  stdio: 'inherit',
  shell: true
});

// 2. Start Vite Dev Server on port 5173
const vite = spawn('npx', ['vite'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  wrangler.kill();
  vite.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
