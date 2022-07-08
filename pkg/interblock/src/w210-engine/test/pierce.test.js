import { assert } from 'chai/index.mjs'
import { Engine } from '..'
import Debug from 'debug'
import { Request } from '../../w008-ipld'
const debug = Debug('interblock:tests:pierce')
Debug.enable()

describe('pierce', () => {
  test('do not txInterblocks to .@@io channel', async () => {
    const engine = await Engine.createCI()
    await engine.pierce(Request.createPing())
    const { latest } = engine
    const network = latest.getNetwork()
    assert.strictEqual(network.channels.txs.length, 0)
    const io = await network.getIo()
    assert.strictEqual(io.tx.system.replies.length, 1)
  })
  test('multiple simultaneous pings maintain order', async () => {
    const engine = await Engine.createCI()
    const p1 = engine.pierce(Request.createPing('ping1'))
    const p2 = engine.pierce(Request.createPing('ping2'))

    // problem is locking the soft update, while buffering
    // we need a softlock, with buffer

    // this buffer is only for piercings and interpulses
    const results = await Promise.all([p1, p2])
    assert.deepEqual(results[0], { string: 'ping1' })
    assert.deepEqual(results[1], { string: 'ping2' })
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
