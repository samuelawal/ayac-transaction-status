import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = Number(process.env.PORT || 4000);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev the React app is served by Vite; every /api call is forwarded to the
    // Node proxy, which is the only thing that talks to Monnify.
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
