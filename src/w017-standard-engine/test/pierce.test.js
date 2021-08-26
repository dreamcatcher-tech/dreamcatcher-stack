import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '..'
import { request } from '../../w002-api'
import { actions } from '../../w021-dmz-reducer'
import Debug from 'debug'
const debug = Debug('interblock:tests:pierce')
Debug.enable()

describe('pierce', () => {
  test('basic ping', async () => {
    const base = await metrologyFactory()
    const ping = request('PING')
    const reply = await base.pierce(ping)
    assert.strictEqual(reply.type, 'PONG')
    const second = await base.pierce(ping)
    assert.strictEqual(second.type, 'PONG')

    debug(`pings complete`)
    await base.settle()
    const remoteIndices = base
      .getState()
      .network['.@@io'].getRemoteRequestIndices()
    assert.strictEqual(remoteIndices.length, 1)
    assert.strictEqual(remoteIndices[0], 1)
  })
  test('do not txInterblocks to .@@io channel', async () => {
    const base = await metrologyFactory()
    const { ioTransmit, sqsTransmit } = base.getEngine()
    let noIoTransmissions = true
    sqsTransmit.subscribe((interblock) => {
      if (interblock.network && interblock.network['.@@io']) {
        noIoTransmissions = false
      }
    })
    await base.pierce(request('PING'))
    assert(noIoTransmissions)
    await base.settle()
  })
  test('multiple simultaneous pings maintain order', async () => {
    const base = await metrologyFactory()
    // base.enableLogging()
    const ping1 = actions.ping('p1')
    const ping2 = actions.ping('p2')
    const p1Promise = base.pierce(ping1)
    const p2Promise = base.pierce(ping2)
    await Promise.all([p1Promise, p2Promise])
    const state = base.getState()
    const io = state.network['.@@io']
    assert.strictEqual(Object.keys(io.replies).length, 2)

    assert.strictEqual(io.replies[0].payload.string, 'p1')
    assert.strictEqual(io.replies[1].payload.string, 'p2')
    await base.settle()
  })
  test.todo('reject for unknown chainId')
  test.todo('reject for unpierced chain')
  test.todo('duplicate piercings only included once')
  test.todo('piercings already in current block excluded')
  test.todo('acl blocked system action is rejected')
  test.todo('unpierced chain rejects attempted outbound pierce')
  test.todo('reject attempt to make channel named .@@io even if pierced')
  test.todo('unpierce during pierce execution drops all other pierces')
  test.todo('opening pierce channel alone does not cause extra lineage')
  test.todo('always at least one tx in the channel to keep count')
  test.todo('change to unpierced removes .@@io channel')
  test.todo('if not in block piercing is not purged from db')
})
