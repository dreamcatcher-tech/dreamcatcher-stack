import assert from 'assert'
import { checkModules } from './lib/index.js'
import { main, module } from './package.json'

describe('package', () => {
  test('Running module load checks on ./lib/index.js', async () => {
    const modules = checkModules()
    assert(Object.keys(modules).length)
  })
  test('package.json/main points to ./lib/index.js', () => {
    assert.strictEqual(main, 'lib/index.js')
    assert.strictEqual(module, 'es/index.js')
  })
  test.todo('ensure no comments in the bundled code')
  test.todo('ensure both bundles are minimized')
})
