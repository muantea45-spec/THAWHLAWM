import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/@react-pdf') ||
            id.includes('node_modules/pdfkit') ||
            id.includes('node_modules/fontkit') ||
            id.includes('node_modules/yoga-layout')
          ) {
            return 'vendor-react-pdf';
          }
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-excel';
          }
          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/jspdf-autotable') ||
            id.includes('node_modules/html2canvas-pro') ||
            id.includes('node_modules/dompurify')
          ) {
            return 'vendor-pdf-print';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react-core';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1500
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
