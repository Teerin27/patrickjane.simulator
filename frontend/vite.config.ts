import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config — https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // The browser talks to /api on its own origin and Vite forwards it to the Express backend,
    // so no CORS is involved in dev. Port 3001 is the backend's default (PORT in backend/.env).
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
