const assert = require('assert')
const debug = require('debug')('interblock:tests:shell')
const { rxReplyModel, actionModel } = require('../../w015-models')
const { shell } = require('..')

describe('machine validation', () => {
  test.todo('opens up a path')
  test.todo('coordinates with simultaneous path openings')
  test.todo('detects changes in filesystem')
  test.todo('rejects invalid path directories')
  test.todo('rejects invalid path files')
  describe('cd', () => {
    test.todo('cd opens up path')
    test.todo('cd rejects if non existent path')
  })
})
