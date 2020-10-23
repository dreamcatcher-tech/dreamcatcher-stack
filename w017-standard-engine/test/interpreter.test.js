const assert = require('assert')
const debug = require('debug')('interblock:tests:interpreter')
const { metrologyFactory } = require('../src/metrologyFactory')
const { shell } = require('../../w212-system-covenants')
require('../../w012-crypto').testMode()

describe('interpreter', () => {
  require('debug').enable('*metrology* *tests* ')
  test('respond to ping with pong', async () => {
    const { covenantId, actions } = shell // shell responds to pings
    const ping = actions.ping()
    const base = await metrologyFactory()
    await base.spawn('pinger', { covenantId })
    const pingerPierce = { ...ping, to: 'pinger' }
    const reply = await base.pierce(pingerPierce)
    await base.settle()
    assert.strictEqual(reply.type, 'PONG')
  })
  test.todo('tick with no response is an instant resolve')
  test.todo('connect on existing is the same as move')
  test.todo('connect resolves an address without purging queued actions')
  test.todo('connect on existing unknown transmits all queued actions')
  test.todo('connect on operational channel empties the channel')
  test.todo('error on reply should surface')
})
