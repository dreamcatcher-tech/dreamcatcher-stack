import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '..'
import { request } from '../../w002-api'
import { actions } from '../../w017-dmz-producer'
import Debug from 'debug'
const debug = Debug('interblock:tests:pierce')
Debug.enable()

describe('pierce', () => {
  test('basic ping', async () => {
    const base = await metrologyFactory()
    const ping1 = request('PING', { count: 1 })
    const first = await base.pierce(ping1)
    assert.strictEqual(first.type, 'PONG')
    assert.strictEqual(first.payload.count, 1)
    const ping2 = request('PING', { count: 2 })
    const second = await base.pierce(ping2)
    assert.strictEqual(second.type, 'PONG')
    assert.strictEqual(second.payload.count, 2)

    debug(`pings complete`)
    await base.settle()
    const baseBlock = await base.getLatest()
    const { replies } = baseBlock.network.get('.@@io')
    assert.strictEqual(replies.size, 1)
    assert.strictEqual(replies.get('1_0').type, '@@RESOLVE')
  })
  test('do not txInterblocks to .@@io channel', async () => {
    const base = await metrologyFactory()
    const { ioTransmit } = base.getEngine()
    let noIoTransmissions = true
    ioTransmit.subscribe((interblock) => {
      noIoTransmissions = false
    })
    await base.pierce(request('PING'))
    await base.settle()
    assert(noIoTransmissions)
  })
  test('multiple simultaneous pings maintain order', async () => {
    const base = await metrologyFactory()
    // base.enableLogging()
    const ping1 = actions.ping('p1')
    const ping2 = actions.ping('p2')
    const p1Promise = base.pierce(ping1)
    const p2Promise = base.pierce(ping2)
    await Promise.all([p1Promise, p2Promise])
    const baseBlock = await base.getLatest()
    const io = baseBlock.network.get('.@@io')
    assert.strictEqual(io.replies.size, 2)
    assert.strictEqual(io.replies.get('0_0').payload.string, 'p1')
    assert.strictEqual(io.replies.get('0_1').payload.string, 'p2')
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
