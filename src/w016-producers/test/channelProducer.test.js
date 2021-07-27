const assert = require('assert')
const random = require('lodash.random')
const {
  request,
  promise,
  resolve,
  reject,
  isReplyFor,
} = require('../../w002-api')
const {
  stateModel,
  channelModel,
  provenanceModel,
  actionModel,
  addressModel,
  networkModel,
  dmzModel,
  blockModel,
  interblockModel,
  continuationModel,
} = require('../../w015-models')
const { channelProducer } = require('..')
const { setAddress, txRequest, txReply, ingestInterblock, shiftTxRequest } =
  channelProducer
require('../../w012-crypto').testMode()

describe('channelProducer', () => {
  test('resolve address', async () => {
    const tx = channelModel.create()
    assert(tx.address.isUnknown())
    const provenance = await provenanceModel.create()
    const address = provenance.getAddress()
    assert(!address.isUnknown())
    const resolved = setAddress(tx, address)
    assert(!resolved.address.isUnknown())
  })
  test('fails on invalid actions supplied', () => {
    const tx = channelModel.create()
    const type = 'testAction'
    assert.throws(() => txRequest(tx, { type, payload: undefined }))
    assert.throws(() => txRequest(tx, { type, payload: { test: 'test' } }))
    assert(txRequest(tx, actionModel.create(type)))
    assert(txRequest(tx, actionModel.create(type, { test: 'test' })))
  })
  test('request', () => {
    let tx = channelModel.create()
    const action = actionModel.create('action1')
    tx = txRequest(tx, action)
    assert(channelModel.isModel(tx))
    assert(action.equals(tx.requests[0]))
    assert.strictEqual(Object.keys(tx.requests).length, 1)
    assert.strictEqual(tx.requestsLength, 1)
  })
  test('duplicate actions throws', () => {
    let channel = channelModel.create()
    const action = actionModel.create('action1')
    channel = txRequest(channel, action)
    assert.throws(() => txRequest(channel, action))
  })
  test('multiple actions requested', () => {
    let twoActions = channelModel.create()
    twoActions = txRequest(twoActions, actionModel.create('action1'))
    twoActions = txRequest(twoActions, actionModel.create('action2'))
    assert.strictEqual(Object.keys(twoActions.requests).length, 2)
    assert.strictEqual(twoActions.requestsLength, 2)

    let many = channelModel.create()
    let count = 0
    Array(10)
      .fill(true)
      .forEach(() => (many = txRequest(many, actionModel.create(`${++count}`))))
    assert.strictEqual(Object.keys(many.requests).length, 10)
    assert.strictEqual(many.requestsLength, 10)
  })
  test('resolve can update previous promises', async () => {
    let remote = channelModel.create(addressModel.create('TEST'))
    remote = txRequest(remote, actionModel.create('action1'))
    remote = txRequest(remote, actionModel.create('action2'))
    remote = txRequest(remote, actionModel.create('action3'))

    const resolveAction = continuationModel.create('@@RESOLVE')
    const promiseAction = continuationModel.create('@@PROMISE')
    const interblock = await reflect(remote)
    let local = channelModel.create(interblock.provenance.getAddress())
    local = ingestInterblock(local, interblock)
    local = txReply(local, promiseAction)
    local = txReply(local, promiseAction)
    local = txReply(local, promiseAction)
    local = txReply(local, resolveAction, 0)

    assert(local.replies[0].type === resolveAction.type)
    assert(local.replies[1].type === promiseAction.type)
    assert(local.replies[2].type === promiseAction.type)

    local = txReply(local, resolveAction, 2)
    assert(local.replies[0].type === resolveAction.type)
    assert(local.replies[1].type === promiseAction.type)
    assert(local.replies[2].type === resolveAction.type)

    assert.strictEqual(local.requestsLength, 0)
    assert.strictEqual(remote.requestsLength, 3)
  })

  test('rxReply returns undefined if no remote yet', () => {
    const action = actionModel.create('RX_REPLY_TEST')
    const dummy = actionModel.create('DUMMY')
    let request = channelModel.create()
    request = channelProducer.txRequest(request, dummy)
    request = channelProducer.txRequest(request, action)
    assert(channelModel.isModel(request))
    assert(!request.rxReply())
  })
  test.todo('txReply defaults to current rxRequest if no index supplied')
  test.todo('receiving same interblock twice is ignored')
  test.todo('children are made with genesis provenance preloaded')
  test.todo('series of interblocks')
  test.todo('reject out of order replies')
  test.todo('reject replies to already resolved actions')
  test.todo('reject two outstanding read requests')
  test.todo('reject interblocks if address not set')

  describe('ingestInterblock', () => {
    test.todo('reject if remote replies do not match transmit')
    test.todo('no telescoping')
    test.todo('remote follows from current remote with no changes')
    test.todo('detect corrupted validators')
    test.todo('negotiate channel reset ?')
    test.todo('reject if channel invalid')
  })

  describe('txReply', () => {
    test('basic', async () => {
      const action = actionModel.create('REMOTE_ACTION')
      let txChannel = channelModel.create(addressModel.create('TEST'))
      txChannel = txRequest(txChannel, action)
      const txInterblock = await reflect(txChannel)

      let rxChannel = channelModel.create()
      rxChannel = setAddress(rxChannel, txInterblock.provenance.getAddress())
      rxChannel = ingestInterblock(rxChannel, txInterblock)
      const remoteRequest = rxChannel.rxRequest()
      assert(remoteRequest.type === action.type)
      const reply = continuationModel.create('@@RESOLVE', {
        test: 'payload',
      })
      assert(reply.isResolve())
      rxChannel = txReply(rxChannel, reply)
      assert(!rxChannel.rxRequest())

      const rxInterblock = await reflect(rxChannel)
      txChannel = setAddress(txChannel, rxInterblock.provenance.getAddress())
      txChannel = ingestInterblock(txChannel, rxInterblock)

      const remoteReply = txChannel.rxReply()
      assert.deepStrictEqual(remoteReply.payload, reply.payload)
      assert(isReplyFor(remoteReply, action))
      txChannel = shiftTxRequest(txChannel)
      assert(!txChannel.rxReply())
    })
    test.todo('promise only valid for current action')
    test.todo('gracefully ignores replies to requests removed from the tail')
    test.todo('cannot reply to index higher than current action')
    test.todo('replies to previous requests must be marked with promise')
    test.todo('cannot reply below zero ?')
    test.todo('wrap around ?')
  })

  describe('shiftTx', () => {
    test('makes next reply available', () => {})
    test.todo('leave transmissions with promises')
    test.todo('finds the lowest key independent of iteration order')
    // TODO allow remote to remove any of its requests
  })
  describe('loopback', () => {
    test.todo('no loopback allowed without systemRole set to LOOPBACK')
  })
})
describe('stress tests', () => {
  // TODO use loopback to ensure we have numbering systems correct
  test('unidirectional randomized', () => {
    // periodically resolve all outstanding promises ?
    // print some stats on action rate
    let on = false
    while (on) {
      // generate random numbers
      const bufferedInterblocksCount = random(10)
      const interblocks = Array(bufferedInterblocksCount).map(() => {
        const bufferedActionsCount = random(10)
        const interblock = transmitNext(bufferedActionsCount)
        return interblock
      })

      // transmit

      // process some number based on outstanding number

      // respond, with buffered amounts ?

      // handle the replies, and shiftTx accordingly
    }

    const printStats = (previous) => {
      let lastTime = Date.now()
      return (current) => {
        const ms = Date.now() - lastTime

        // requests,
        // requests open
        // resolved requests (includes promised and direct resolves)
        // promises outstanding
        // promises resolved
        // time difference,

        lastTime = Date.now()
        previous = current
      }
    }

    let id = 0
    const transmitNext = (bufferedActionsCount = 1) => {
      const actions = Array(bufferedActionsCount).map(() =>
        request('STRESS', { id: id++ })
      )
      const state = stateModel.create({ actions })

      // produce a new interblock
    }

    const receive = (bufferedInterblocks) => {
      // randomize how many interblocks are received in a batch before processing
    }
    const reply = (processCount, promisesCount) => {
      // how many actions to process, how many of those should be promises, and
      // how many outstanding promises to clear each round
    }
  })
  test.todo('unidirectional random self rejection')
  test.todo('bidirectional')
  test.todo('benchmark max possible throughput')
  test.todo('benchmark with fake crypto')
  test.todo('wrap around at limits of integer')
})
const reflect = async (transmission) => {
  assert(channelModel.isModel(transmission))
  const network = networkModel.create({ transmission })
  const dmz = dmzModel.create({ network })
  const block = await blockModel.create(dmz)
  assert(block.isValidated())
  const interblock = interblockModel.create(block, 'transmission')
  return interblock
}
