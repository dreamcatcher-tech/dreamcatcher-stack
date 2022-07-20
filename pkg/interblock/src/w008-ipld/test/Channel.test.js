import { assert } from 'chai/index.mjs'
import { Request, Address, Channel, Reply } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:Channel')
const fakeChannelId = 100
describe('channel', () => {
  describe('create', () => {
    test('basic', async () => {
      const channel = Channel.create(fakeChannelId)
      const crushed = await channel.crush()
      const diff = crushed.getDiffBlocks()
      assert.strictEqual(diff.size, 2)
      expect([...diff.keys()]).toMatchSnapshot()
    })
    test('create', async () => {
      let channel = Channel.create(fakeChannelId)
      assert(channel.address.isUnknown())
      assert(!channel.tx.precedent)
      assert(!channel.rx.tip)
      const crushed = await channel.crush()
      const blocks = crushed.getDiffBlocks()
      const resolver = (cid) => blocks.get(cid.toString())
      const uncrushed = await Channel.uncrush(crushed.cid, resolver)
      assert.deepEqual(crushed, uncrushed)

      const request = Request.create('TEST_ACTION')
      const reply = Reply.create()
      channel = channel.txRequest(request)
      assert(channel.address.isUnknown())
      assert.throws(() => channel.txReducerReply(reply), 'Address is')
      const recrushed = await channel.crush()
      assert(recrushed)
    })
    test('address is not modified', () => {
      const address = Address.createUnknown()
      const channel = Channel.create(fakeChannelId, address)
      assert.strictEqual(channel.address, address)
    })
    test('root can only be parent', () => {
      const address = Address.createRoot()
      const notParentChannelId = fakeChannelId
      const msg = 'root not parent'
      assert.throws(() => Channel.create(notParentChannelId, address), msg)
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
