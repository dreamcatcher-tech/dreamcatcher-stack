import { assert } from 'chai/index.mjs'
import { interchain } from '../../w002-api'
import { wrapReduce } from '..'
import Debug from 'debug'
import { AsyncRequest, Reply, Request, RequestId } from '../../w008-ipld'
const debug = Debug('interblock:tests:hooks')
Debug.enable()
const request = Request.create('TEST')

/**
 * Test callsites for resolve and for multiple promises
 * Test using prepopulated accumulators
 *
 * Then test the engine using prepop accumulators for specific actions
 * to avoid code relooping and making it hard to trace
 *
 *
 */
describe.only('callsites', () => {
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
      const reduction = await wrapReduce(request, reducer)

      assert(reduction.isPending())
      const { txs, reply, ...rest } = reduction
      assert.deepEqual(rest, {})
      assert(reply.isPromise())
      assert(Array.isArray(txs))
      assert.strictEqual(txs.length, depth)
    })
    test('void return', async () => {
      const voidReturn = () => {
        return
      }
      const reduction = await wrapReduce(request, voidReturn)
      assert(!reduction.isPending())
      assert(reduction.reply.isResolve())
      assert.deepEqual(reduction.reply.payload, {})
      assert.strictEqual(reduction.txs.length, 0)
      assert.strictEqual(Object.keys(reduction).length, 2)
    })
    test('plain reply', async () => {
      const payload = { plain: true }
      const plain = () => payload
      const reduction = await wrapReduce(request, plain)
      assert(!reduction.isPending())
      assert(reduction.reply.isResolve())
      assert.strictEqual(reduction.reply.payload, payload)
      assert.strictEqual(reduction.txs.length, 0)
      assert.strictEqual(Object.keys(reduction).length, 2)
    })
    test.todo('nested calls to wrapReduce')
    test('nested parallel hooks do not collide', async () => {
      // make many simultaneous calls, and ensure none of them throw an error, and all return correct data
      const inits = Array(4).fill(true)
      const nestedDepth = 4
      const awaits = inits.map((_, index) => {
        const reducer = nested(index, nestedDepth + index)
        return wrapReduce(request, reducer)
      })
      const results = await Promise.all(awaits)
      expect(results).toMatchSnapshot()
    })
    test('reduction must be an object', async () => {
      const msg = 'Must return either undefined, or an object'
      const e1 = await wrapReduce(request, () => () => 'arrow fn')
      assert.strictEqual(e1.getError().message, msg)
      const e2 = await wrapReduce(request, () => true)
      assert.strictEqual(e2.getError().message, msg)
      const e3 = await wrapReduce(request, () => 'string')
      assert.strictEqual(e3.getError().message, msg)
      const e4 = await wrapReduce(request, () => 5)
      assert.strictEqual(e4.getError().message, msg)
    })
    test('duplicate requests permitted in same call', async () => {
      const double = async () => {
        interchain('twin')
        interchain('twin')
        // TODO supply a response, and verify the second request gets a different response
        return {}
      }
      const reduction = await wrapReduce(request, double)
      const { txs } = reduction
      assert.strictEqual(txs.length, 2)
      assert(reduction.isPending())
    })
    test('resolved result', async () => {
      const resolved = async () => {
        await Promise.resolve()
        return { resolved: true }
      }
      const reduction = await wrapReduce(request, resolved)
      const { reply, txs } = reduction
      assert.strictEqual(txs.length, 0)
      assert(reply.isResolve())
      assert(!reduction.isPending())
    })
    test('reject', async () => {
      const rejector = async () => {
        throw new Error('rejected')
      }
      const reduction = await wrapReduce(request, rejector)
      assert.strictEqual(reduction.getError().message, 'rejected')
      assert.strictEqual(reduction.isPending(), false)
    })
    test('timeout exceeded', async () => {
      const slowest = () => {
        return new Promise(() => Infinity)
      }
      const result = await wrapReduce(request, slowest)
      assert.strictEqual(result.getError().message, 'timeout exceeded: 100 ms')
    })
    test.todo('duplicate requests permitted in different calls')
  })
  describe('with accumulator', () => {
    test('single await', async () => {
      let interchainResult
      const single = async () => {
        interchainResult = await interchain('single')
      }
      const reduction = await wrapReduce(request, single)
      assert.strictEqual(interchainResult, undefined)
      assert(reduction.isPending())
      assert.strictEqual(reduction.txs.length, 1)
      let [pendingRequest] = reduction.txs
      assert(pendingRequest instanceof AsyncRequest)
      expect(pendingRequest).toMatchSnapshot()
      const requestId = RequestId.createCI()
      const resolve = Reply.create('@@RESOLVE', { single: true })
      pendingRequest = pendingRequest.setId(requestId).settle(resolve)
      const asyncs = [pendingRequest]
      const { reply, txs: txs2 } = await wrapReduce(request, single, asyncs)
      assert.strictEqual(txs2.length, 0)
      assert.strictEqual(interchainResult.single, true)
      assert(reply.isResolve())
      assert.deepEqual(reply.payload, {})
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
      const { txs } = await wrapReduce(request, reject)
      assert.strictEqual(interchainResult, undefined)
      let [pendingRequest] = txs
      const requestId = RequestId.createCI()
      const rejection = Reply.create('@@REJECT', new Error('test rejection'))
      pendingRequest = pendingRequest.setId(requestId).settle(rejection)
      const asyncs = [pendingRequest]
      const reduction = await wrapReduce(request, reject, asyncs)
      const error = reduction.getError()
      assert.strictEqual(error.message, 'test rejection')
      assert(interchainResult instanceof Error)
    })
    test.todo('throw on incomplete accumulator')
  })
})
