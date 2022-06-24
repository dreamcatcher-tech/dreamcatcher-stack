import { assert } from 'chai/index.mjs'
import { interchain } from '../../w002-api'
import { wrapReduce } from '..'
import Debug from 'debug'
import {
  AsyncRequest,
  AsyncTrail,
  Reply,
  Request,
  RequestId,
  RxRequest,
  RxReply,
} from '../../w008-ipld'
const debug = Debug('interblock:tests:hooks')
Debug.enable()
const request = Request.create('TEST')
const requestId = RequestId.createCI()
const rxRequest = RxRequest.create(request, requestId)
const init = AsyncTrail.create(rxRequest)
/**
 * Test callsites for resolve and for multiple promises
 * Test using prepopulated accumulators
 *
 * Then test the engine using prepop accumulators for specific actions
 * to avoid code relooping and making it hard to trace
 *
 * test the engine incrementally with each new system function
 *
 *
 */
describe('callsites', () => {
  describe('basics', () => {
    const nested =
      (id, depth = 0) =>
      async () => {
        if (depth === 0) {
          return { id }
        } else {
          interchain(`id: ${id} depth: ${depth}`)
          return nested(id, depth - 1)()
        }
      }

    test('nested hooks awaited', async () => {
      const id = 57
      const depth = 1000
      const reducer = nested(id, depth)
      const trail = await wrapReduce(init, reducer)

      assert(trail.isPending())
      assert(!trail.reply)
      assert(Array.isArray(trail.txs))
      assert.strictEqual(trail.txs.length, depth)
    })
    test('void return', async () => {
      const voidReturn = () => {
        return
      }
      const trail = await wrapReduce(init, voidReturn)
      assert(!trail.isPending())
      assert(trail.reply.isResolve())
      assert.deepEqual(trail.reply.payload, {})
      assert.strictEqual(trail.txs.length, 0)
    })
    test('plain reply', async () => {
      const payload = { plain: true }
      const plain = () => payload
      const trail = await wrapReduce(init, plain)
      assert(!trail.isPending())
      assert(trail.reply.isResolve())
      assert.strictEqual(trail.reply.payload, payload)
      assert.strictEqual(trail.txs.length, 0)
    })
    test.todo('nested calls to wrapReduce')
    test('nested parallel hooks do not collide', async () => {
      const inits = Array(4).fill(true)
      const nestedDepth = 4
      const awaits = inits.map((_, index) => {
        const reducer = nested(index, nestedDepth + index)
        return wrapReduce(init, reducer)
      })
      const results = await Promise.all(awaits)
      expect(results).toMatchSnapshot()
    })
    test('reduction must be an object', async () => {
      const msg = 'Must return either undefined, or an object'
      const e1 = await wrapReduce(init, () => () => 'arrow fn')
      assert.strictEqual(e1.getError().message, msg)
      const e2 = await wrapReduce(init, () => true)
      assert.strictEqual(e2.getError().message, msg)
      const e3 = await wrapReduce(init, () => 'string')
      assert.strictEqual(e3.getError().message, msg)
      const e4 = await wrapReduce(init, () => 5)
      assert.strictEqual(e4.getError().message, msg)
    })
    test('duplicate requests permitted in same call', async () => {
      const double = async () => {
        interchain('twin')
        interchain('twin')
        // TODO supply a response, and verify the second request gets a different response
        return {}
      }
      const trail = await wrapReduce(init, double)
      const { txs } = trail
      assert.strictEqual(txs.length, 2)
      assert(trail.isPending())
    })
    test('resolved result', async () => {
      const resolved = async () => {
        await Promise.resolve()
        return { resolved: true }
      }
      const trail = await wrapReduce(init, resolved)
      const { reply, txs } = trail
      assert.strictEqual(txs.length, 0)
      assert(reply.isResolve())
      assert(!trail.isPending())
    })
    test('reject', async () => {
      const rejector = async () => {
        throw new Error('rejected')
      }
      const trail = await wrapReduce(init, rejector)
      assert.strictEqual(trail.getError().message, 'rejected')
      assert.strictEqual(trail.isPending(), false)
    })
    test('timeout exceeded', async () => {
      const slowest = () => {
        return new Promise(() => Infinity)
      }
      const trail = await wrapReduce(init, slowest)
      assert.strictEqual(trail.getError().message, 'timeout exceeded: 100 ms')
    })
    test.todo('duplicate requests permitted in different calls')
  })
  describe('with asyncs', () => {
    test('single await', async () => {
      let interchainResult
      const single = async () => {
        interchainResult = await interchain('single')
      }
      let trail = await wrapReduce(init, single)
      assert.strictEqual(interchainResult, undefined)
      assert(trail.isPending())
      assert.strictEqual(trail.txs.length, 1)
      let [pendingRequest] = trail.txs
      assert(pendingRequest instanceof AsyncRequest)
      expect(pendingRequest).toMatchSnapshot()
      pendingRequest = pendingRequest.setId(requestId)
      trail = trail.updateTxs([pendingRequest])
      const reply = Reply.create('@@RESOLVE', { single: true })
      const rxReply = RxReply.create(reply, requestId)
      trail = trail.settleTx(rxReply)
      trail = await wrapReduce(trail, single)
      assert.strictEqual(trail.txs.length, 0)
      assert.strictEqual(interchainResult.single, true)
      assert(trail.reply.isResolve())
      assert.deepEqual(trail.reply.payload, {})
    })
    test('rejection', async () => {
      let interchainResult
      const reject = async () => {
        try {
          interchainResult = await interchain('single')
        } catch (error) {
          interchainResult = error
          throw error
        }
      }
      let trail = await wrapReduce(init, reject)
      assert.strictEqual(interchainResult, undefined)
      let [pendingRequest] = trail.txs
      pendingRequest = pendingRequest.setId(requestId)
      trail = trail.updateTxs([pendingRequest])
      const rejection = Reply.create('@@REJECT', new Error('test rejection'))
      const rxReply = RxReply.create(rejection, requestId)
      trail = trail.settleTx(rxReply)
      trail = await wrapReduce(trail, reject)
      const error = trail.getError()
      assert.strictEqual(error.message, 'test rejection')
      assert(interchainResult instanceof Error)
    })
    test.todo('throw on incomplete accumulator')
  })
})
