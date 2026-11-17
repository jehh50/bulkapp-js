import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, /api se reenvía a la API: mismo origen para el navegador, así
// la cookie de refresco (SameSite=Strict) funciona sin CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:4000', changeOrigin: false } },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { mui: ['@mui/material', '@emotion/react', '@emotion/styled'], charts: ['@mui/x-charts'] },
      },
    },
  },
});
