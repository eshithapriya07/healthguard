import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Express backend so the app is same-origin
// (no CORS problems during development).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: Number(process.env.PORT || 3000),
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
