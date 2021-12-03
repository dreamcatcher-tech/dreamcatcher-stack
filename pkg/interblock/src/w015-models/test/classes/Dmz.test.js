import { assert } from 'chai/index.mjs'
import { Dmz } from '../../src/classes'
import Debug from 'debug'
const debug = Debug('interblock:tests:Dmz')
Debug.enable('interblock:tests*')

describe('dmz', () => {
  test('create defaults', () => {
    const dmz = Dmz.create()
    const array = dmz.toArray()
    debug(array)
    const clone = Dmz.restore(array)
    assert.deepEqual(dmz.toArray(), clone.toArray())
  })

  test('create', () => {
    const same1 = Dmz.create()
    const same2 = Dmz.create({
      timestamp: same1.timestamp,
      encryption: same1.encryption,
    })
    assert.deepEqual(same1, same2)
    assert.deepEqual(same1.toArray(), same2.toArray())
    assert(same1.equals(same2))

    const different = Dmz.create()
    assert.notDeepEqual(same1.toArray(), different.toArray())
  })
  test.todo('nextAction cycles through all possible channels')
  test.todo('nextAction returns undefined if no next action')
  test.todo('ensure no duplicate addresses in transmit slice')
})
