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
    // target: es2020 added as workaround to make big ints work
    // https://github.com/vitejs/vite/issues/9062#issuecomment-1182818044
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'esnext',
    minify: false,
  },
  define: {
    'process.env.NODE_DEBUG': 'false',
    global: 'globalThis',
  },
})
