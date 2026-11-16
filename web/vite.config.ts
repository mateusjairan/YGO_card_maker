import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Em dev o Vite faz proxy para a API (mesma origem => sem CORS e links iguais aos de produção)
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // permite importar shared/card.css (fonte única do CSS da carta)
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true }, // /health e /health/live
      '/media': { target: apiTarget, changeOrigin: true },
      '/static': { target: apiTarget, changeOrigin: true },
      '^/c/': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
      '/media': { target: apiTarget, changeOrigin: true },
      '/static': { target: apiTarget, changeOrigin: true },
      '^/c/': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
