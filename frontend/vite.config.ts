import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Direct proxy for docs or other root level endpoints if needed
      '/docs': 'http://localhost:8001',
      '/openapi.json': 'http://localhost:8001',
    },
  },
})
