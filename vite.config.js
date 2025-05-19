import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: 'ui',
  base: './',
  build: {
    outDir: '../dist/ui',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        ui: path.resolve(__dirname, 'ui/ui.html'),
        savedTabs: path.resolve(__dirname, 'ui/saved-tabs.html')
      }
    }
  }
})