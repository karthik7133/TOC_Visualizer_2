import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://automata-visualizer-groq.onrender.com',
        changeOrigin: true,
        // Allow up to 5 minutes for AI generation (model is split CPU/GPU)
        proxyTimeout: 300_000,
        timeout:      300_000,
      },
    },
  },
});
