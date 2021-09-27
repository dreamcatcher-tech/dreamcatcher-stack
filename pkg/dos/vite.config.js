import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { dependencies } = require('./package.json')
dependencies['chai/index.mjs'] = true

/**
 * ora must be held at 3.0.0 as this is the last version not using nodejs globals
 * assert must be included as ora includes cli-cursor which includes signal-exit
 *    which uses assert as though it was a nodejs global.
 *
 * There is still some dangerous interdependencies on packages and monkey patch
 * order for globals.  This stack is fragile but the cost of fixing it is cheaper
 * than tracing the root cause.  Suspect the root cause is ora.
 */

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    target: 'esnext',
    minify: 'esbuild', // required to transform biginteger in noble-crypto
    rollupOptions: {
      plugins: [visualizer({ filename: './dist/vis.html' })],
      external: Object.keys(dependencies),
    },
    lib: {
      formats: ['es'],
      entry: path.resolve('./src/index.mjs'),
    },
  },
})
