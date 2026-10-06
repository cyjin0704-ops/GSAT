import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves this repository below /GSAT/. Vite applies this prefix to
// the application bundle, imported images, and the PDF.js worker URL.
export default defineConfig({
  base: '/GSAT/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
  },
  plugins: [react()],
})
