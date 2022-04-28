import { assert } from 'chai/index.mjs'
import { Loopback, Request, Address, Channel, Reply, Network } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:Channel')
Debug.enable()

describe('loopback', () => {
  test('basic', async () => {
    let loopback = Loopback.create()
    loopback = await loopback.crush()
    const ping = Request.create('PING')
    loopback = loopback.txRequest(ping)
    const channelId = Network.FIXED_IDS.LOOPBACK
    assert.strictEqual(channelId, loopback.channelId)
    const rxRequest = loopback.rxReducerRequest(channelId)
    assert.strictEqual(rxRequest.index, 0)
    assert.strictEqual(rxRequest.channelId, channelId)
    assert.strictEqual(rxRequest.stream, 'reducer')
    assert.strictEqual(rxRequest.type, ping.type)

    const requestId = loopback.tx.reducer.getRequestId()
    assert.strictEqual(requestId, 0)

    const pong = Reply.create()
    loopback = loopback.txReducerReply(pong)
    assert(!loopback.rxReducerRequest(channelId))
    const rxReply = loopback.rxReducerReply(channelId)
    assert.strictEqual(rxReply.type, pong.type)

    loopback = loopback.shiftReducerReply()
    assert(!loopback.rxReducerReply(channelId))

    const last = await loopback.crush()
    last.dir()
    last.logDiff()
  })
})
