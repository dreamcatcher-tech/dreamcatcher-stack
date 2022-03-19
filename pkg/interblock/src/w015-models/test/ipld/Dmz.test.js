import { assert } from 'chai/index.mjs'
import { Dmz } from '../../src/ipld'
import Debug from 'debug'
const debug = Debug('interblock:tests:Dmz')

describe('dmz', () => {
  test('create', async () => {
    const same1 = Dmz.create()
    const same2 = Dmz.create({
      timestamp: same1.timestamp,
    })
    assert.deepEqual(same1, same2)
    const crush1 = await same1.crush()
    const crush2 = await same2.crush()
    const diff1 = await crush1.getDiffBlocks()
    const diff2 = await crush2.getDiffBlocks()
    assert.deepEqual(diff1, diff2)
  })
  test.todo('ensure no duplicate addresses in transmit slice')
})
