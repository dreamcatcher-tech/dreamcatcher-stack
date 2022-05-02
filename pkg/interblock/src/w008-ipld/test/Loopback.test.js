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
    const rxRequest = loopback.rxReducerRequest()
    assert.strictEqual(rxRequest.requestIndex, 0)
    assert.strictEqual(rxRequest.channelId, channelId)
    assert.strictEqual(rxRequest.stream, 'reducer')
    assert.strictEqual(rxRequest.type, ping.type)

    const pong = Reply.create()
    loopback = loopback.txReducerReply(pong)
    assert(!loopback.rxReducerRequest())
    const rxReply = loopback.rxReducerReply()
    assert.strictEqual(rxReply.type, pong.type)

    loopback = loopback.shiftReducerReply()
    assert(!loopback.rxReducerReply(channelId))
    const { reducer: rxReducer } = loopback.rx
    assert.strictEqual(rxReducer.requestsLength, 1)
    assert.strictEqual(rxReducer.repliesLength, 1)
    const { reducer: txReducer } = loopback.tx
    assert.strictEqual(txReducer.requestsLength, 0)
    assert.strictEqual(txReducer.repliesLength, 0)

    const last = await loopback.crush()
    expect(last).toMatchSnapshot()
  })
})
