import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { dependencies: deps } = require('./package.json')

// every imported path not in package.json must be excluded from the bundle
deps['chai/index.mjs'] = true
deps['react'] = true
deps['react-dom'] = true
deps['xterm/css/xterm.css'] = true
deps['@material-ui/core/styles'] = true
deps['@material-ui/core/Dialog'] = true
deps['@material-ui/core/DialogTitle'] = true
deps['@material-ui/core/DialogContent'] = true
deps['leaflet/dist/leaflet.css'] = true
deps['leaflet-draw/dist/leaflet.draw.css'] = true
deps['leaflet-draw/dist/leaflet.draw.js'] = true
deps['leaflet.markercluster/dist/MarkerCluster.css'] = true
deps['leaflet.markercluster/dist/MarkerCluster.Default.css'] = true
deps['leaflet-extra-markers/dist/css/leaflet.extra-markers.min.css'] = true
deps['leaflet-extra-markers/dist/js/leaflet.extra-markers.min'] = true

/**
 * Make client-project be just the terminal, so that can do front end easily
 *
 * Build and dev strategy for making npm modules work with vite:
 *    1. handle runtime use of nodejs globals by applying polyfiles to globalThis
 *        in the library that uses it eg: dos, interblock, webdos
 *    2. use replace plugin to do highly targetted text replacement of import time
 *        uses of node globals, such as process, buffer.  Use a seperate instance
 *        of the plugin for each npm package that needs operating on
 *    3. anything at import time that does not work for this strategy uses highly
 *        targetted inject plugin to import one of the globals
 *    4. where possible in the dependency graph use alias to resolve browser
 *        friendly versions
 *    5. define is best for strings, as consistent behaviour between dev and build
 *    6. first, try to remove the offending library from usage, if within our control
 *
 * Troubleshooting tactics:
 *    1. use sourcemaps on build, then try run in browser
 *    2. breakpoint in the plugins code to see if they apply correctly
 *    3. fork replace plugin to allow it to jump out of baseProject ? or wait until hoist?
 *    4. ensure the full dep chain is fulfilled, else gives empty result from require()
 *    5. ensure that common js files end in .cjs and es modules end in .mjs
 *
 * Other options:
 *    1. use alias to make a shim load which adds process and other to globalThis ?
 *    2. load each problematic library using a shim alias
 *
 * Problems:
 *    1. dev concats files sometimes, but build does not, so high precision by
 *       filename does not work reliably.  Alias is the ultimate in precision.
 *    2. replace does not run during dev
 *    3. cannot mix import and require, else the commonjs bundler ignores mixed instances
 *        so if inject an import in a cjs file, require ends up undefined
 *
 * Solved all problems by forking packages, particularly mock-stdin
 *
 * Workspaces:
 *    Publish only webdos
 *    run a bundler with a minifier
 *    or, publish all packages at once
 *    refer to interblock using relative path in webdos
 *    use git submodules to house the independent packages ?
 *    set all packages to private, except webdos
 *
 *    nest interblock and dos inside of webdos, treat webdos as a base package
 *
 *    publish each package independently, do a replace on webdos to pull in code not built
 *
 *    publish only webdos, but link to the other packages at build time
 *    publish all packages, including built versions of interblock with minification
 */

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    target: 'esnext',
    minify: 'esbuild', // required to transform biginteger in noble-crypto
    sourcemap: true,
    rollupOptions: {
      plugins: [visualizer({ filename: './dist/vis.html' })],
      external: Object.keys(deps),
    },
    lib: {
      formats: ['es'],
      entry: path.resolve('./src/index.mjs'),
    },
  },
  /**
   * Hot updating blockmodel results in an endless hmr loop of the module that
   * imports interblock.
   * Even after removing sodium-plus there is still an infinite
   * loop on change to blockmodel.
   * Definitely part of circular dependencies as fixes with: https://github.com/vitejs/vite/issues/2466
   * Could not manage to get an HMR boundary inserted within interblock, so need a custom plugin.
   * With all circular dependencies removed, still cause endless hmr loop.
   * Suspect models and modelUtils causes some confusing loops for the hmr reloader.
   * These ought be fixed in vite eventually, but we have not the time to pursue them further.
   *
   * Conclusion is that the hot update plugin is required until fixed in vite.
   * This would not be a problem for a project importing interblock from npm.
   * Rewards so far are:
   *    Rapid HMR of webdos and dos with interblock
   *    Rapid dev of interblock in browser as page refresh is near instant
   *    Small bundle size from es modules
   *
   * TODO:
   *    Bundle to prod
   *    run with dos
   *    run with webdos
   *    publish all with minified interblock
   *    publish webdos as a single unified library
   *
   * Plan for publishing webdos
   *    refer to code directly with a relative path
   *    use vite as to test webdos in dev, then bundle to library mode
   *    test with client projects that refer to webdos directly
   *    bundle and minify webdos so it is the only bundle produced
   *
   *
   * Plan for publishing client project
   *    refer to the interblock and webdos codebases directly during dev
   *    clients should pull from npm to ensure version stability,
   *    and independence from 'next'
   *
   */
})
