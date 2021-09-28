import { assert } from 'chai/index.mjs'
import { checkModules, effectorFactory } from './dist/interblock.es'
import packageJson from './package.json'
import viteConfig from './vite.config'
const { main, type } = packageJson

describe('package', () => {
  test('Running module load checks on ./lib/index.js', async () => {
    checkModules()
    assert.strictEqual(typeof effectorFactory, 'function')
  })
  test('package.json/main points to dist/interblock.es.js', () => {
    assert.strictEqual(main, 'dist/interblock.es.js')
    assert.strictEqual(type, 'module')
  })
  test('vite config is minimized with no sourcemap', () => {
    assert.strictEqual(viteConfig.build.minify, 'esbuild')
    assert.strictEqual(viteConfig.build.sourcemap, undefined)
  })
  test.todo('ensure no comments in the bundled code')
  test.todo('ensure both bundles are minimized')
})
