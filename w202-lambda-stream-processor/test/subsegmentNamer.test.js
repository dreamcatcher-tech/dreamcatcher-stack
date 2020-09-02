const assert = require('assert')
const debug = require('debug')('interblock:tests:aws')
const { subsegmentNamer } = require('../src/awsLogger')
describe('subsegmentNamer', () => {
  test('nested', () => {
    const nested = { some: { deep: 'path' } }
    debug(`nested: %o`, nested)
    const name = subsegmentNamer(nested)
    assert.equal(typeof name, 'string')
  })
  test('string', () => {
    const plain = 'plain legal name'
    const name = subsegmentNamer(plain)
    assert.equal(typeof name, 'string')
    assert(!name.includes(':'))
  })

  test('illegal string', () => {
    const plain = '{ } " \' illegal name'
    assert.throws(() => subsegmentNamer(plain))
  })
  test('illegal object', () => {
    const nested = { some: { 'dee}p': 'path' } }
    assert.throws(() => subsegmentNamer(nested))
  })
})
