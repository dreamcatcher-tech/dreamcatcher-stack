import assert from 'assert'
import { metrologyFactory } from '../src/metrologyFactory'
import { shell, hyper, probe } from '../../w212-system-covenants'
import { isReplyFor } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:tests:heart')
Debug.enable()

describe('interpreter', () => {
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
  test('error on reply should surface', async () => {
    const reducer = (state, action) => {
      debug(`reducer: `, action.type)
      if (isReplyFor(action)) {
        debug(`reply received`, action)
        throw new Error('testing no replies')
      }
      return shell.reducer(state, action)
    }

    const covenants = { hyper: { ...hyper, reducer } }
    const base = await metrologyFactory('int', covenants)
    base.enableLogging()

    await base.spawn('pinger', { covenantId: probe.covenantId })
    let reply
    try {
      reply = await base.pierce(shell.actions.ping('pinger'))
    } catch (error) {
      debug(error)
    }
    // TODO reject all self actions, then reject the external action
    // assert(!reply)
    await base.settle()
  })
})
