const assert = require('assert')
const { isReplyFor } = require('../../w002-api')
const {
  actionModel,
  addressModel,
  continuationModel,
  channelModel,
  provenanceModel,
} = require('..')
require('../../w012-crypto').testMode()

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
      const clone = channelModel.clone()
      assert(clone.address.isUnknown())
    })
    test('blank returns no requests or replies', () => {
      const tx = channelModel.create()
      assert(!tx.rxReply())
      assert(!tx.rxRequest())
    })
    test('disordered entries in requests array', () => {
      const tx = channelModel.create()
      const action = actionModel.create('action1')
      const withJumble = channelModel.clone({
        ...tx,
        requests: { 0: action, 3: action, 2: action },
      })
      assert(withJumble)
      assert.throws(() =>
        channelModel.clone({
          ...tx,
          requests: { 0: action, [-1]: action, 2: action },
        })
      )
      assert.throws(() =>
        channelModel.clone({
          ...tx,
          requests: { 0: action, notNumber: action, 2: action },
        })
      )
    })
    test('includes known address', async () => {
      const provenance = await provenanceModel.create()
      const address = provenance.getAddress()
      const channel = channelModel.create(address)
      assert(channel.address.equals(address))
    })
  })
  describe('clone', () => {
    test.todo('verify provenance holds proof for remote slice')
    test.todo('throws on replies non linear')
    test.todo('clone throws if no address but some remote slice')
    test.todo('clone throws if replies but no address')
    test.todo('clone throws if replies do not match remote requests')
    test.todo('throw if loopback and contains banned actions')
    test('throws on remote replies ahead of requests', () => {
      const resolvedAddress = addressModel.create('test')
      const channelBase = channelModel.create(resolvedAddress)
      assert.throws(() =>
        channelModel.clone({
          ...channelBase,
          remote,
          requests: { 23: request1 },
        })
      )
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
  describe('isTxGreaterThan', () => {
    test.todo('ignore shiftTx')
    test.todo('ignore promise only replies')
  })
})
