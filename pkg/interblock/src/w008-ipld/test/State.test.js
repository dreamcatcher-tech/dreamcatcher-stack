import { assert } from 'chai/index.mjs'
import { State } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:State')

describe('state', () => {
  test('basic', async () => {
    let state = State.create()
    assert(state.isModified())
    state = await state.crush()
    assert(!state.isModified())
    let diff = state.getDiffBlocks()
    assert.strictEqual(diff.size, 1)
    let resolver = (cid) => [diff.get(cid.toString())]
    let uncrushed = await State.uncrush(state.cid, resolver)
    assert(!state.isModified())
    assert.deepEqual(state.toJS(), uncrushed.toJS())

    state = uncrushed.setMap({ some: { nested: 'data' } })
    assert(state.isModified())
    state = await state.crush()
    diff = state.getDiffBlocks()
    assert.strictEqual(diff.size, 1)
    resolver = (cid) => [diff.get(cid.toString())]
    uncrushed = await State.uncrush(state.cid, resolver)
    assert(!state.isModified())
    assert.deepEqual(state.toJS(), uncrushed.toJS())
  })
  test('no undefined state keys during serialize', () => {
    assert(State.create({ not: 'missing' }))
    assert.throws(() => State.create({ missing: undefined }))
    assert.throws(() => State.create({ n: { m: undefined } }))
    assert.throws(() => State.create(null))
    assert(State.create({ n: { m: null } }))
  })
  test.todo('state non serializable')
})
