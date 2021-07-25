const assert = require('assert')
const { checkModules } = require('./lib/index.js')

describe('package', () => {
  test('Running module load checks on ./lib/index.js', async () => {
    const modules = checkModules()
    assert(Object.keys(modules).length)
  })
  test('package.json/main points to ./lib/index.js', () => {
    const { main, module } = require('./package.json')
    assert.strictEqual(main, 'lib/index.js')
    assert.strictEqual(module, 'es/index.js')
  })
  test.todo('ensure no comments in the bundled code')
  test.todo('ensure both bundles are minimized')
})
