import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

console.log('env', globalThis.process.env)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { minify: false },
})
