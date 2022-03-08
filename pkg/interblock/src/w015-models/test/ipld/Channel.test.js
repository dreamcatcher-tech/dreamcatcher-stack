import { assert } from 'chai/index.mjs'
import { Request, Address, Channel, Reply, Provenance } from '../../src/ipld'
import Debug from 'debug'
const debug = Debug('interblock:tests:Channel')
Debug.enable()

describe('channel', () => {
  describe('create', () => {
    test('basic', async () => {
      const channel = Channel.create()
      const crushed = await channel.crush()
    })
    test('create', () => {
      const channel = Channel.create()
      assert(channel.address.isUnknown())
      assert(channel.precedent.isUnknown())
      assert(!channel.tip)
      const arr = channel.toArray()
      const restored = Channel.restore(arr)
      assert(restored.address.isUnknown())
      assert(restored.precedent.isUnknown())
      assert(!restored.tip)
      assert(restored.deepEquals(channel))

      const action = Request.create('TEST_ACTION')
      const reply = Continuation.create()
      const array = channel.toArray()
      array[3] = [action.toArray()]

      const deepRestore = Channel.restore(array)
      assert(deepRestore.requests.every((a) => a instanceof Request))
      const withReply = deepRestore.update({ replies: { '0_3': reply } })
      for (const [key, value] of withReply.replies.entries()) {
        assert.strictEqual(key, '0_3')
        assert(value instanceof Continuation)
      }
    })
    test('includes known address', () => {
      const provenance = Provenance.create()
      const address = provenance.getAddress()
      const channel = Channel.create(address)
      assert(channel.address.deepEquals(address))
    })
    test.todo('loopback bans @@OPEN_CHILD action')
  })
  describe('clone', () => {
    test.todo('verify provenance holds proof for remote slice')
    test.todo('throws on replies non linear')
    test.todo('clone throws if no address but some remote slice')
    test.todo('clone throws if replies but no address')
    test.todo('clone throws if replies do not match remote requests')
    test.todo('throw if loopback and contains banned actions')
  })
  describe('loopback', () => {
    test.only('basic', async () => {
      let channel = Channel.createLoopback()
      let crushed = await channel.crush()
      const ping = Request.create('PING')
      channel = channel.txReducerRequest(ping)
      assert.strictEqual(channel.rxReducerRequest(), ping)
      const requestId = channel.tx.reducer.getRequestId()
      assert.strictEqual(requestId, 0)

      const pong = Reply.create()
      channel = channel.txReducerReply(pong)
      assert(!channel.rxReducerRequest())
      assert.strictEqual(channel.rxReducerReply(), pong)

      channel = channel.shiftReducerReplies()
      assert(!channel.rxReducerReply())

      const last = await channel.crush()
      last.logDiff()
      last.logDiff(crushed)
    })
    test('_nextCoords', () => {
      let channel = Channel.create(Address.create('LOOPBACK'), '.')
      const [ih, ii] = channel._nextCoords()
      assert.strictEqual(ih, 1)
      assert.strictEqual(ii, 0)

      channel = channel.update({ tipHeight: 1 })
      const [fh, fi] = channel._nextCoords()
      assert.strictEqual(fh, 2)
      assert.strictEqual(fi, 0)

      channel = channel.update({ rxRepliesTip: '2_0' })
      const [rh, ri] = channel._nextCoords()
      assert.strictEqual(rh, 2)
      assert.strictEqual(ri, 1)

      channel = channel.update({ rxRepliesTip: '2_1' })
      const [lh, li] = channel._nextCoords()
      assert.strictEqual(lh, 2)
      assert.strictEqual(li, 2)

      channel = channel.update({ rxRepliesTip: '3_1' })
      assert.strictEqual(channel.tipHeight, 1)
      assert.throws(channel._nextCoords)
    })
  })
  describe('rxRequest', () => {
    test.todo('undefined if address unknown and not loopback')
    test.todo('can specify index')
  })
  describe('rxReply', () => {
    test.todo('undefined if address unknown and not loopback')
    test.todo('return remote reply promise if request was supplied')
    test.todo('no remote reply promise if no request param')
    test.todo('invalid request param throws')
    test.todo('invalid channel outstanding promises reject')
  })
})
