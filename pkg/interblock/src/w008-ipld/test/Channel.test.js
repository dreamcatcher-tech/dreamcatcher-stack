import { assert } from 'chai/index.mjs'
import { Request, Address, Channel, Reply } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:Channel')
Debug.enable()

describe('channel', () => {
  describe('create', () => {
    test('basic', async () => {
      const channel = Channel.create()
      const crushed = await channel.crush()
      const diff = await crushed.getDiffBlocks()
      assert.strictEqual(diff.size, 3)
    })
    test('create', async () => {
      let channel = Channel.create()
      assert(channel.tx.address.isUnknown())
      assert(!channel.tx.precedent)
      assert(!channel.tip)
      const crushed = await channel.crush()
      const blocks = await crushed.getDiffBlocks()
      const resolver = (cid) => blocks.get(cid.toString())
      const uncrushed = await Channel.uncrush(crushed.cid, resolver)
      assert.deepEqual(crushed, uncrushed)

      const request = Request.create('TEST_ACTION')
      const reply = Reply.create()
      channel = channel.txReducerRequest(request)
      assert(channel.tx.address.isUnknown())
      assert.throws(() => channel.txReducerReply(reply), 'Replies to')
      const recrushed = await channel.crush()
    })
    test('includes known address', () => {
      const address = Address.createRoot()
      const channel = Channel.create(address)
      assert.strictEqual(channel.tx.address, address)
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
    test('basic', async () => {
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
