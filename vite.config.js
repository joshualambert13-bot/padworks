import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/]three[\\/]/.test(id)) return 'three';
          if (id.includes('@react-three')) return 'r3f';
        },
      },
    },
  },
});
