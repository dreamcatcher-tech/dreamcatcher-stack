import { assert } from 'chai/index.mjs'
import { Request, Reply, Network } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:Channel')

describe('loopback', () => {
  test('basic', async () => {
    let network = Network.create()
    let loopback = await network.getLoopback()
    const channelId = Network.FIXED_IDS.LOOPBACK
    assert.strictEqual(channelId, loopback.channelId)
    loopback = await loopback.crushToCid()
    const ping = Request.create('PING')
    loopback = loopback.txRequest(ping)
    network = await network.updateLoopback(loopback)
    loopback = await network.getLoopback()
    const { request, requestId } = loopback.rxReducerRequest()
    assert.strictEqual(requestId.requestIndex, 0)
    assert.strictEqual(requestId.channelId, channelId)
    assert.strictEqual(requestId.stream, 'reducer')
    assert.strictEqual(request.type, ping.type)

    const pong = Reply.create()
    loopback = loopback.txReducerReply(pong)
    network = await network.updateLoopback(loopback)
    loopback = await network.getLoopback()
    assert(!loopback.rxReducerRequest())
    const { reply } = loopback.rxReducerReply()
    assert.strictEqual(reply.type, pong.type)

    loopback = loopback.shiftReducerReply()
    network = await network.updateLoopback(loopback)
    loopback = await network.getLoopback()
    assert(!loopback.rxReducerReply(channelId))
    const { reducer: rxReducer } = loopback.rx
    assert.strictEqual(rxReducer.requestsLength, 1)
    assert.strictEqual(rxReducer.repliesLength, 1)
    const { reducer: txReducer } = loopback.tx
    assert.strictEqual(txReducer.requestsLength, 1)
    assert.strictEqual(txReducer.repliesLength, 1)

    const last = await loopback.crushToCid()
    expect(last).toMatchSnapshot()
  })
})
