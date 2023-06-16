import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

/**
 * ora must be held at 3.0.0 as this is the last version not using nodejs globals
 * assert must be included as ora includes cli-cursor which includes signal-exit
 *    which uses assert as though it was a nodejs global.
 *
 * There is still some dangerous interdependencies on packages and monkey patch
 * order for globals.  This stack is fragile but the cost of fixing it is cheaper
 * than tracing the root cause.  Suspect the root cause is ora.
 */

const { dependencies } = require('./package.json')
dependencies['chai/index.mjs'] = true

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
    rollupOptions: {
      plugins: [visualizer({ filename: './dist/vis.html' })],
      external: Object.keys(dependencies),
    },
    lib: {
      formats: ['es'],
      entry: path.resolve('./src/index.mjs'),
    },
  },
  define: {
    // 'process.env.NODE_DEBUG': 'false',
  },
})
