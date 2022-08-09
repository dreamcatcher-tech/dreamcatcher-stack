import { assert } from 'chai/index.mjs'
import { Dmz } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:Dmz')

describe('dmz', () => {
  test('create', async () => {
    const same1 = Dmz.create()
    const same2 = Dmz.create({
      timestamp: same1.timestamp,
    })
    assert.deepEqual(same1, same2)
    const crush1 = await same1.crushToCid()
    const crush2 = await same2.crushToCid()
    const diff1 = crush1.getDiffBlocks()
    const diff2 = crush2.getDiffBlocks()
    assert.deepEqual(diff1, diff2)
  })
  test.todo('ensure no duplicate addresses in transmit slice')
})
