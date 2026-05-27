import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4007,
    host: true,
    hmr: {
      overlay: false,
      timeout: 300000,
      clientPort: 4007,
      protocol: 'ws'
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    },
    proxy: {
      '/api': { target: 'http://localhost:4005', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4005', ws: true, changeOrigin: true },
      '/binance': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/binance/, ''),
        secure: false
      }
    }
  }
})
