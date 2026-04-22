import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server config: proxy /mock to the python mock server to avoid CORS
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Cloudflare Tunnel や他ホスト名経由でアクセスできるようにする
    // Vite 5 では allowedHosts: true でホストチェックを無効化できる
    allowedHosts: true,
    proxy: {
      '/mock': {
        // Forward /mock requests to the Python mock server port used in this workspace
        target: 'http://127.0.0.1:8025',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/mock/, '/mock')
      }
    }
  }
})
