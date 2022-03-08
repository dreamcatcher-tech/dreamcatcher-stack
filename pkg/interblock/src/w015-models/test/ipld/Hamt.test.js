import assert from 'assert-fast'
import { Hamt } from '../../src/ipld/Hamt'

describe.only('Hamt', () => {
  test('basic', async () => {
    const base = Hamt.create()
    let hamt = base.set('testkey', 'testvalue')
    assert(base !== hamt)
    assert.strictEqual(hamt.get('testkey'), 'testvalue')
    assert(hamt.isModified())
    const crushed = await hamt.crush()
    console.log(crushed.cid)
  })
  test.todo('with class')
  test.todo('stress test')
})
