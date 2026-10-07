// Renderer only, in a plain browser (no Electron): `npm run dev:web`.
// window.api is undefined here, so the renderer falls back to its dev-only mock bridge.
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve('src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  server: { port: 5173, strictPort: true },
  plugins: [react()]
})
