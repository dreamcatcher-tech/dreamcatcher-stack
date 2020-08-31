const assert = require('assert')
const {
  interblockModel,
  dmzModel,
  stateModel,
  blockModel,
  addressModel,
} = require('../../w015-models')
const { dispatches } = require('../../w021-dmz-reducer')
const { networkProducer } = require('..')
require('../../w012-crypto').testMode()

describe('networkProducer', () => {
  test.todo('addValidator appends to existing list')
  describe('ingestInterblocks', () => {
    test.todo('foreign chain cannot claim child')
    test.todo('previous provenances are discarded but all new ones are kept')
  })
  describe('transmit coordination with receive', () => {
    test.todo('special rules for children vs symlinks ?')
    test.todo('throw if receive interblock but no matching connection')
    test.todo('throw if interblock missing lineage to our last known receipt')
    test.todo('if empty stream, only accept genesis')
    test.todo('interblocks are ordered by height')
    test.todo('ingest only takes interblocks that have changes in them')
    test.todo('final self reply removes the alias')
  })
  describe('spawn', () => {
    test.todo('spawn refuses for existing alias')
    test.todo('spawn with no alias generates automatic names')
    test.todo('spawn only uses parent validators')
    test.todo('when address resolves, tick the counter forwards 1')
  })
  describe('merge', () => {
    test.todo('simple merge')
    test.todo('delete channel which is being responded to')
    test.todo('rename channel which is being responded to')
  })
  describe('tx', () => {
    test.todo('can only promise at tip of channel')
    test.todo('can settle with tip of channel')
    test.todo('settle before tip must have a promise in place')
    test.todo('address must be present')
    test.todo('if rx is a reply, no replies to current action allowed')
    test.todo('ignore replies to nonexistent addresses')
  })
})
