import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'https://shesystem.anuruk3030.workers.dev',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
