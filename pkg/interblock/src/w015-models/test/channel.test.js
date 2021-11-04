import { assert } from 'chai/index.mjs'
import { actionModel, addressModel, channelModel, provenanceModel } from '..'

describe('channel', () => {
  describe('create', () => {
    test('create speed', () => {
      const precompileFlush = channelModel.create()
      const start = Date.now()
      channelModel.create()
      const elapsed = Date.now() - start
      assert(elapsed < 3, elapsed)
    })
    test('create', () => {
      const channel = channelModel.create()
      assert(channel.address.isUnknown())
      assert(channel.precedent.isUnknown())
      assert(!channel.tip)
      const clone = channelModel.clone()
      assert(clone.address.isUnknown())
      assert(clone.precedent.isUnknown())
      assert(!clone.tip)
    })
    test('includes known address', () => {
      const provenance = provenanceModel.create()
      const address = provenance.getAddress()
      const channel = channelModel.create(address)
      assert(channel.address.equals(address))
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
  describe.only('loopback', () => {
    test.only('_nextCoords', () => {
      let channel = channelModel.create(addressModel.create('LOOPBACK'), '.')
      const [ih, ii] = channel._nextCoords()
      assert.strictEqual(ih, 1)
      assert.strictEqual(ii, 0)

      channel = channelModel.clone({ ...channel, tipHeight: 1 })
      const [fh, fi] = channel._nextCoords()
      assert.strictEqual(fh, 2)
      assert.strictEqual(fi, 0)

      channel = channelModel.clone({ ...channel, rxRepliesTip: '2_0' })
      const [rh, ri] = channel._nextCoords()
      assert.strictEqual(rh, 2)
      assert.strictEqual(ri, 1)

      channel = channelModel.clone({ ...channel, rxRepliesTip: '2_1' })
      const [lh, li] = channel._nextCoords()
      assert.strictEqual(lh, 2)
      assert.strictEqual(li, 2)

      channel = channelModel.clone({ ...channel, rxRepliesTip: '3_1' })
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
