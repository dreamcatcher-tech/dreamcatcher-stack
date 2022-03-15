import { assert } from 'chai/index.mjs'
import { Dmz } from '../../src/ipld'
import Debug from 'debug'
const debug = Debug('interblock:tests:Dmz')

describe('dmz', () => {
  test('create defaults', () => {
    const dmz = Dmz.create()
  })

  test('create', () => {
    const same1 = Dmz.create()
    const same2 = Dmz.create({
      timestamp: same1.timestamp,
      encryption: same1.encryption,
    })
    assert.deepEqual(same1, same2)
    assert.deepEqual(same1.toArray(), same2.toArray())
    assert(same1.deepEquals(same2))

    const different = Dmz.create()
    assert.notDeepEqual(same1.toArray(), different.toArray())
  })
  test.todo('nextAction cycles through all possible channels')
  test.todo('nextAction returns undefined if no next action')
  test.todo('ensure no duplicate addresses in transmit slice')
})
