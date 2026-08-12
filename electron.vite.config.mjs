import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode)
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: { rollupOptions: { external: ['better-sqlite3'] } },
      define: {
        'process.env.CHAVE_GEMINI': JSON.stringify(env.CHAVE_GEMINI || env.GCP_API_KEY || '')
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      plugins: [react()]
    }
  }
})