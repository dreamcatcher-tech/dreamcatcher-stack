const assert = require('assert')
const { reifyCovenant } = require('../src/execution/utils')
describe('reifyCovenant', () => {
  test('loads system covenant', () => {
    const shell = 'system/shell'
    const covenant = reifyCovenant(shell)
    assert(covenant && covenant.reducer)
  })
  test('rejects invalid system covenant', () => {
    assert.throws(() => reifyCovenant())
    assert.throws(() => reifyCovenant('system/rubbish'))
  })
  test.skip('loads from file path', () => {
    const path = require('path')
    const pingpongPath = path.resolve(
      __dirname,
      '../../w302-test-covenants/pingpong'
    )
    const pingpong = reifyCovenant(pingpongPath)
    assert(pingpong && pingpong.reducer)
  })
  test('rejects on invalid file path', () => {
    const invalidPath = 'some/invalid/path'
    assert.throws(() => reifyCovenant(invalidPath))
  })
  test('rejects if loaded covenant invalid, including reducer', () => {
    const invalidCovenant = '..'
    assert.throws(() => reifyCovenant(invalidCovenant))
  })
  test.todo('returns an already reified covenant if reference is an object')
})
