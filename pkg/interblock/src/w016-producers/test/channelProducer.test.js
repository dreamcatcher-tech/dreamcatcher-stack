import { assert } from 'chai/index.mjs'
import random from 'lodash.random'
import { request, isReplyFor } from '../../w002-api'
import {
  stateModel,
  channelModel,
  provenanceModel,
  actionModel,
  addressModel,
  networkModel,
  dmzModel,
  blockModel,
  interblockModel,
  txReplyModel,
  Conflux,
  rxRequestModel,
  rxReplyModel,
} from '../../w015-models'
import { channelProducer } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:producers:channel')
Debug.enable('')

const {
  setAddress,
  txRequest,
  txReply,
  ingestInterblocks,
  shiftLoopbackSettle,
  shiftLoopbackReply,
} = channelProducer

describe('channelProducer', () => {
  test('resolve address', () => {
    const tx = channelModel.create()
    assert(tx.address.isUnknown())
    const provenance = provenanceModel.create()
    const address = provenance.getAddress()
    assert(!address.isUnknown())
    const resolved = setAddress(tx, address)
    assert(!resolved.address.isUnknown())
  })
  test('fails on invalid actions supplied', () => {
    const tx = channelModel.create()
    const type = 'testAction'
    assert(txRequest(tx, actionModel.create(type)))
    assert.throws(() => txRequest(tx, { type, payload: undefined }))
    assert(txRequest(tx, actionModel.create(type, { test: 'test' })))
    assert.throws(() => txRequest(tx, { type, payload: { test: 'test' } }))
  })
  test('duplicate actions throws', () => {
    let channel = channelModel.create()
    const action = actionModel.create('action1')
    channel = txRequest(channel, action)
    assert.throws(() => txRequest(channel, action))
  })
  test('request', () => {
    let tx = channelModel.create()
    const action = actionModel.create('action1')
    tx = txRequest(tx, action)
    assert(channelModel.isModel(tx))
    assert(action.equals(tx.requests[0]))
    assert.strictEqual(tx.requests.length, 1)
  })
  test('multiple actions requested', () => {
    let twoActions = channelModel.create()
    twoActions = txRequest(twoActions, actionModel.create('action1'))
    twoActions = txRequest(twoActions, actionModel.create('action2'))
    assert.strictEqual(twoActions.requests.length, 2)

    let many = channelModel.create()
    let count = 0
    Array(10)
      .fill(true)
      .forEach(() => (many = txRequest(many, actionModel.create(`${++count}`))))
    assert.strictEqual(many.requests.length, 10)
  })
  test('resolve can update previous promises', () => {
    let remote = channelModel.create(addressModel.create('TEST'))
    remote = txRequest(remote, actionModel.create('action1'))
    remote = txRequest(remote, actionModel.create('action2'))
    remote = txRequest(remote, actionModel.create('action3'))
    const [interblock] = reflect(remote)

    let local = channelModel.create(interblock.provenance.getAddress())
    const [nextLocal] = ingestInterblocks(local, [interblock])
    local = nextLocal
    // need to get the conflux out ? create an array of rxRequest models?
    const seq = `${interblock.getChainId()}_${interblock.provenance.height}_`

    local = txReply(local, txReplyModel.create('@@PROMISE', {}, seq + 0))
    local = txReply(local, txReplyModel.create('@@PROMISE', {}, seq + 1))
    local = txReply(local, txReplyModel.create('@@PROMISE', {}, seq + 2))
    local = txReply(local, txReplyModel.create('@@RESOLVE', {}, seq + 0))

    assert(local.replies['0_0'].type === '@@RESOLVE')
    assert(local.replies['0_1'].type === '@@PROMISE')
    assert(local.replies['0_2'].type === '@@PROMISE')

    local = txReply(local, txReplyModel.create('@@RESOLVE', {}, seq + 2))
    assert(local.replies['0_0'].type === '@@RESOLVE')
    assert(local.replies['0_1'].type === '@@PROMISE')
    assert(local.replies['0_2'].type === '@@RESOLVE')

    assert.strictEqual(local.requests.length, 0)
    assert.strictEqual(Object.keys(local.replies).length, 3)
  })
  test.todo(
    'txReply enforces replyKey correctness'
    // make a txReply object with bogus height and index - should throw
  )
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
    test('throws on interblock replies ahead of requests', () => {
      const resolvedAddress = addressModel.create('test')
      const channelBase = channelModel.create(resolvedAddress)
      const request1 = actionModel.create('request1')
      // TODO make a fake remote which replied out of sequence
      // assert.throws(
      //   () =>
      //     channelModel.clone({
      //       ...channelBase,
      //       // remote: undefined,
      //       requests: { 23: request1 },
      //     }),
      //   (err) => {
      //     console.log(err)
      //   }
      // )
    })
  })

  describe('txReply', () => {
    test('basic', () => {
      const action = actionModel.create('REMOTE_ACTION')
      let txChannel = channelModel.create(addressModel.create('TEST'))
      txChannel = txRequest(txChannel, action)
      const [txInterblock] = reflect(txChannel)

      let rxChannel = channelModel.create()
      rxChannel = setAddress(rxChannel, txInterblock.provenance.getAddress())
      const [nextRx, rxIngested] = ingestInterblocks(rxChannel, [txInterblock])
      rxChannel = nextRx
      assert.strictEqual(rxIngested.length, 1)
      assert(rxIngested[0] === txInterblock)

      const rxConflux = new Conflux(rxIngested)
      assert.strictEqual(rxConflux.rxRequests.length, 1)
      const request = rxConflux.rxRequests[0]
      assert.strictEqual(request.type, action.type)
      const { identifier } = request
      const reply = txReplyModel.create('@@RESOLVE', { t: 'p' }, identifier)
      rxChannel = txReply(rxChannel, reply)
      assert(rxChannel.replies['0_0'].isResolve())

      const [rxInterblock] = reflect(rxChannel)
      // recreate but with known rx address now
      txChannel = channelModel.create(rxInterblock.provenance.getAddress())
      txChannel = txRequest(txChannel, action)
      const [nextTx, txIngested] = ingestInterblocks(txChannel, [rxInterblock])
      txChannel = nextTx
      assert.strictEqual(txIngested.length, 1)
      assert(txIngested[0] === rxInterblock)

      const txConflux = new Conflux(txIngested)
      assert.strictEqual(txConflux.rxReplies.length, 1)
      assert.strictEqual(txConflux.rxRequests.length, 0)

      const rxReply = txConflux.rxReplies[0]
      assert.deepEqual(rxReply.payload, reply.payload)
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
    test.only('basic', () => {
      const loopbackAddress = addressModel.create('LOOPBACK')
      let loopback = channelModel.create(loopbackAddress, '.')

      // transmit two requests
      const action1 = actionModel.create('LOOPBACK_ACTION_1')
      const action2 = actionModel.create('LOOPBACK_ACTION_2')
      const action3 = actionModel.create('LOOPBACK_ACTION_3')
      loopback = txRequest(loopback, action1)
      loopback = txRequest(loopback, action2)
      loopback = txRequest(loopback, action3)
      assert.strictEqual(loopback.requests.length, 3)
      const rxReq1 = loopback.rxLoopbackRequest()
      assert(rxReq1.equals(loopback.rxLoopbackRequest()))
      assert(rxRequestModel.isModel(rxReq1))
      assert.throws(() => shiftLoopbackReply(loopback))
      assert.throws(() => shiftLoopbackSettle(loopback))

      // transmit a reply to the first action
      const { identifier } = rxReq1
      assert.strictEqual(identifier, 'LOOPBACK_0_0')
      const txRep1 = txReplyModel.create('@@RESOLVE', {}, identifier)
      loopback = txReply(loopback, txRep1)
      const rxRep1 = loopback.rxLoopbackReply()
      assert(rxReplyModel.isModel(rxRep1))
      assert.strictEqual(rxRep1.identifier, identifier)
      assert.throws(() => txReply(loopback, txRep1))

      // promise to respond later
      loopback = shiftLoopbackReply(loopback)
      const rxReq2 = loopback.rxLoopbackRequest()
      assert.strictEqual(rxReq2.type, action2.type)
      const txRep2 = txReplyModel.create('@@PROMISE', {}, rxReq2.identifier)
      loopback = txReply(loopback, txRep2)
      assert.throws(() => txReply(loopback, txRep2))
      assert(rxReq2.equals(loopback.rxLoopbackRequest()))
      assert(loopback.isLoopbackReplyPromised())
      assert(!loopback.rxPromises)
      loopback = shiftLoopbackReply(loopback)
      assert.strictEqual(loopback.rxPromises.length, 1)
      assert.strictEqual(loopback.rxPromises[0], '0_1')

      // reject the final request
      const rxReq3 = loopback.rxLoopbackRequest()
      assert.strictEqual(rxReq3.type, action3.type)
      const txRep3 = txReplyModel.create('@@REJECT', {}, rxReq3.identifier)
      loopback = txReply(loopback, txRep3)
      loopback = shiftLoopbackReply(loopback)
      assert(loopback.isLoopbackExhausted())

      // resolve the prior promise
      const p = { promise: 'resolve' }
      const txRep4 = txReplyModel.create('@@RESOLVE', p, rxReq2.identifier)
      loopback = txReply(loopback, txRep4)
      assert(!loopback.isLoopbackExhausted())
      assert(!loopback.isLoopbackReplyPromised())
      assert(!loopback.rxLoopbackReply())
      assert(!loopback.rxLoopbackRequest())
      const rxReq4 = loopback.rxLoopbackSettle()
      assert.strictEqual(rxReq4.payload.promise, 'resolve')

      loopback = shiftLoopbackSettle(loopback)
      assert(loopback.isLoopbackExhausted())
    })
    test.todo('cannot reply twice to a request')
    test.todo('cannot promise twice to a request')
    test.todo('cannot resolve a promise twice')
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
const reflect = (transmission) => {
  assert(channelModel.isModel(transmission))
  const network = networkModel.create({ transmission })
  const dmz = dmzModel.create({ network })
  const block = blockModel.create(dmz)
  assert(block.isVerifiedBlock())
  const interblock = interblockModel.create(block, 'transmission')
  return [interblock, block]
}
