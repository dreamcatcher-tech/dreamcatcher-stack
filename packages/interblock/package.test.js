import { assert } from 'chai'
import { checkModules } from './lib/index.js'
import packageJson from './package.json'
const { main, module } = packageJson

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
