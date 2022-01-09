import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { dependencies } = require('./package.json')
dependencies['@noble/hashes/sha256'] = true
dependencies['@noble/hashes/utils'] = true

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
