import * as dotenv from 'dotenv'
import git from 'git-rev-sync'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import process from 'process'
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

const { dependencies: deps } = require('./package.json')

// every imported path not in package.json must be excluded from the bundle
deps['react'] = true
deps['react-dom'] = true
deps['xterm/css/xterm.css'] = true
deps['leaflet/dist/leaflet.css'] = true
deps['leaflet-draw/dist/leaflet.draw.css'] = true
deps['leaflet-draw/dist/leaflet.draw.js'] = true
deps['leaflet.markercluster/dist/MarkerCluster.css'] = true
deps['leaflet.markercluster/dist/MarkerCluster.Default.css'] = true
deps['leaflet-extra-markers/dist/css/leaflet.extra-markers.min.css'] = true
deps['leaflet-extra-markers/dist/js/leaflet.extra-markers.min'] = true

const gitPath = '../..'
const VITE_GIT_HASH = JSON.stringify(git.long(gitPath))
const VITE_GIT_DATE = JSON.stringify(git.date())

const config = {
  plugins: [react()],
  build: {
    // done only so the size of the bundle can be inspected
    target: 'es2020',
    rollupOptions: {
      plugins: [visualizer({ filename: './dist/vis.html' })],
      // external: Object.keys(deps),
    },
    minify: true,
    sourcemap: true,
  },
  server: {},
  clearScreen: false,
  define: {
    VITE_GIT_HASH,
    VITE_GIT_DATE,
    // used by the 'util' module
    'process.env.NODE_DEBUG': 'false',
  },
}
dotenv.config({ path: '../../.env' })
const { env } = process
if (env.SSL_PRIVATE_KEY && env.SSL_CERT_CHAIN && env.SSL_HOSTNAME) {
  Object.assign(config.server, {
    https: {
      hostname: env.SSL_HOSTNAME,
      key: env.SSL_PRIVATE_KEY,
      cert: env.SSL_CERT_CHAIN,
    },
  })
}
// https://vitejs.dev/config/
export default defineConfig(config)
