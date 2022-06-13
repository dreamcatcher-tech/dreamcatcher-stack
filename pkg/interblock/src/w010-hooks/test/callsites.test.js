import { assert } from 'chai/index.mjs'
import { interchain, respond } from '../../w002-api'
import { wrapReduce } from '..'
import Debug from 'debug'
import { PendingRequest, Reply, RequestId, RxReply } from '../../w008-ipld'
const debug = Debug('interblock:tests:hooks')
Debug.enable()
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
      const { state, txs, isPending } = await wrapReduce(nested(id, depth))
      assert.strictEqual(state, undefined)
      assert.strictEqual(isPending, true)
      assert(Array.isArray(txs))
      assert.strictEqual(txs.length, depth)
    })
    test('plain state', async () => {
      const plain = () => ({ plain: true })
      const { state, isPending } = await wrapReduce(plain)
      assert(state.plain)
      assert.strictEqual(isPending, undefined)
    })
    test.todo('nested calls to wrapReduce')
    test('nested parallel hooks do not collide', async () => {
      // make many simultaneous calls, and ensure none of them throw an error, and all return correct data
      const inits = Array(4).fill(true)
      const nestedDepth = 4
      const awaits = inits.map((_, index) => {
        return wrapReduce(nested(index, nestedDepth + index))
      })
      const results = await Promise.all(awaits)
      // console.dir(results, { depth: null })
      expect(results).toMatchSnapshot()
    })
    test('reduction must be an object', async () => {
      const msg = 'Must return either undefined, or an object'
      const e1 = await wrapReduce(() => () => 'arrow fn')
      assert.strictEqual(e1.error.message, msg)
      const e2 = await wrapReduce(() => true)
      assert.strictEqual(e2.error.message, msg)
      const e3 = await wrapReduce(() => 'string')
      assert.strictEqual(e3.error.message, msg)
      const e4 = await wrapReduce(() => 5)
      assert.strictEqual(e4.error.message, msg)
    })
    test('duplicate requests permitted in same call', async () => {
      const double = async () => {
        interchain('twin')
        interchain('twin')
        // TODO supply a response, and verify the second request gets a different response
        return {}
      }
      const { state, txs, isPending } = await wrapReduce(double)
      assert.strictEqual(txs.length, 2)
      assert.strictEqual(state, undefined)
      assert.strictEqual(isPending, true)
    })
    test('resolved result', async () => {
      const resolved = async () => {
        await Promise.resolve()
        return { resolved: true }
      }
      const { state, txs, isPending } = await wrapReduce(resolved)
      assert.strictEqual(txs.length, 0)
      assert.strictEqual(state.then, undefined)
      assert.strictEqual(state.resolved, true)
      assert.strictEqual(isPending, undefined)
    })
    test('reject', async () => {
      const rejector = async () => {
        throw new Error('rejected')
      }
      const { state, txs, error, isPending } = await wrapReduce(rejector)
      assert.strictEqual(state, undefined)
      assert.strictEqual(txs, undefined)
      assert.strictEqual(error.message, 'rejected')
      assert.strictEqual(isPending, undefined)
    })
    test('respond to request', async () => {
      const replier = () => {
        respond({ response: true })
        return { response: true }
      }
      const { state, txs, isPending, error } = await wrapReduce(replier)
      assert(state.response)
      assert.strictEqual(txs.length, 1)
      assert.strictEqual(isPending, undefined)
      assert.strictEqual(error, undefined)
      const [reply] = txs
      assert(reply instanceof Reply)
      assert(reply.isResolve())
      assert.deepEqual(reply.payload, { response: true })
    })
    test('reply twice rejects', async () => {
      let isThrown = false
      const replier = () => {
        respond({ response: 1 })
        try {
          respond({ response: 2 })
        } catch (error) {
          isThrown = true
        }
        return { response: 'after throw' }
      }
      const { state, txs, isPending, error } = await wrapReduce(replier)
      assert(isThrown)
      assert.deepEqual(state, { response: 'after throw' })
      assert.strictEqual(txs.length, 1)
      assert.strictEqual(isPending, undefined)
    })
    test('timeout exceeded', async () => {
      const slowest = () => {
        return new Promise(() => Infinity)
      }
      const result = await wrapReduce(slowest)
      assert.strictEqual(result.error.message, 'timeout exceeded: 500 ms')
    })
    test.todo('duplicate requests permitted in different calls')
  })
  describe('with accumulator', () => {
    test('single await', async () => {
      let interchainResult
      const single = async () => {
        interchainResult = await interchain('single')
        return { state: 'test' }
      }
      const { isPending, txs } = await wrapReduce(single)
      assert.strictEqual(interchainResult, undefined)
      assert.strictEqual(isPending, true)
      assert.strictEqual(txs.length, 1)
      let [pendingRequest] = txs
      assert(pendingRequest instanceof PendingRequest)
      expect(pendingRequest).toMatchSnapshot()
      const requestId = RequestId.createCI()
      const reply = Reply.create('@@RESOLVE', { single: true })
      pendingRequest = pendingRequest.setId(requestId).settle(reply)
      const accumulator = [pendingRequest]
      const { error, state, txs: txs2 } = await wrapReduce(single, accumulator)
      assert.strictEqual(error, undefined, error)
      assert.deepEqual(state, { state: 'test' })
      assert.strictEqual(txs2.length, 0)
      assert.strictEqual(interchainResult.single, true)
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
      const { txs } = await wrapReduce(reject)
      assert.strictEqual(interchainResult, undefined)
      let [pendingRequest] = txs
      const reply = Reply.create('@@REJECT', new Error('test rejection'))
      pendingRequest = pendingRequest.settle(reply)
      const accumulator = [pendingRequest]
      const { error, state } = await wrapReduce(reject, accumulator)
      assert.strictEqual(error.message, 'test rejection')
      assert.strictEqual(state, undefined)
      assert(interchainResult instanceof Error)
      assert.strictEqual(interchainResult, error)
    })
    test.todo('throw on incomplete accumulator')
  })
})
