const assert = require('assert')
const { dmzModel } = require('..')
require('../../w012-crypto').testMode()

describe('dmz', () => {
  test('create defaults', () => {
    const dmz = dmzModel.create()
    const clone = dmzModel.clone(dmz)
    assert(dmz.equals(clone))
    const emptyClone = dmzModel.clone()
    const reclone = dmzModel.clone(emptyClone)
    assert(emptyClone.equals(reclone))
  })

  test('create', () => {
    const same1 = dmzModel.create()
    const same2 = dmzModel.create({
      timestamp: same1.timestamp,
      encryption: same1.encryption,
    })
    assert.deepStrictEqual(same1, same2)
    assert(same1.equals(same2))
  })
  test.todo('nextAction cycles through all possible channels')
  test.todo('nextAction returns undefined if no next action')
  test.todo('ensure no duplicate addresses in transmit slice')
})
