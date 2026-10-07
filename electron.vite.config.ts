import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        ...shared
      }
    },
    // Fixed port so modelwright's preview (http://localhost:5173) works with `npm run dev` too.
    server: { port: 5173, strictPort: true },
    plugins: [react()]
  }
})
