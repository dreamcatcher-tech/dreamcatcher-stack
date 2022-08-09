import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// dependencies are split out here to test pure bundle size
const { dependencies } = require('./package.json')
dependencies['@noble/hashes/sha256'] = true
dependencies['multiformats/cid'] = true
dependencies['multiformats/block'] = true
dependencies['multiformats/codecs/raw'] = true
dependencies['multiformats/hashes/hasher'] = true
dependencies['@libp2p/crypto'] = true
dependencies['uint8arrays/to-string'] = true
dependencies['uint8arrays/from-string'] = true

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
    'process.env.NODE_DEBUG': 'false',
  },
  test: {
    globals: true,
    deps: {
      // required workaround for 0.20.x upgrade
      // https://github.com/vitest-dev/vitest/issues/1758
      // registerNodeLoader: false,
    },
  },
})
