import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import inject from '@rollup/plugin-inject'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
// https://vitejs.dev/config/

export default defineConfig({
  plugins: [
    reactRefresh(),
    {
      name: 'singleHMR workaround',
      handleHotUpdate({ modules, file }) {
        modules.map((m) => {
          const interblockModels = 'w015'
          if (m.file.includes(interblockModels)) {
            m.importedModules = new Set()
            m.importers = new Set()
          }
        })
        return modules
      },
    },
    inject({
      // when changing, must use --force on the dev server to rebuild deps
      // use inject to insert shims for global variables used in dependencies
      process: 'process', // assert
      global: path.resolve('global.js'), // assert
      Buffer: ['buffer', 'Buffer'], // mock-stdin
    }),
  ],
  resolve: {
    alias: {
      stream: path.resolve('node_modules/stream-browserify'), // mock-stdin
      events: path.resolve('node_modules/events'), // mock-stdin
      path: path.resolve('node_modules/path-browserify'), // Route.jsx
    },
  },
  // define: {
  // 'process.env.NODE_DEBUG': false, // for assert.js
  // global: 'globalThis', // lifesaver
  // },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      plugins: [visualizer({ filename: './dist/vis.html' })],
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
