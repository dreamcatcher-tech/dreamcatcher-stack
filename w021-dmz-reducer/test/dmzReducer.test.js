const assert = require('assert')
const { request } = require('../../w002-api')
const {
  dmzModel,
  actionModel,
  addressModel,
  stateModel,
} = require('../../w015-models')
const { networkProducer } = require('../../w016-producers')
const dmzReducer = require('..')
require('../../w012-crypto').testMode()

describe('dmzReducer', () => {
  test.todo('connect on existing is the same as move')
  test.todo('connect resolves an address without purging queued actions')
  test.todo('connect on existing unknown transmits all queued actions')
  test.todo('connect on operational channel empties the channel')
  describe('openPaths', () => {
    test.todo('missing parents with open children skips straight to children')
    test.todo('cannot be more than one outstanding @@OPEN request in a channel')
    test.todo('3 levels deep')
    test.todo('random path opening and closing and reopening')
  })
})
