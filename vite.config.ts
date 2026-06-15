import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gapi': {
        target: 'https://oauth2.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gapi/, ''),
        secure: true
      },
      '/api.php': {
        target: 'http://localhost/matheus-protese-pwa/public',
        changeOrigin: true,
        secure: false
      },
      '/gapi_proxy.php': {
        target: 'http://localhost/matheus-protese-pwa/public',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
