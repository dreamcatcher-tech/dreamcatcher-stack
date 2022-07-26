import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { dependencies } = require('./package.json')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['protons-runtime'],
  },
})
