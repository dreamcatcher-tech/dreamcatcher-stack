import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { _hook as hook, interchain, effect } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:hooks')
chai.use(chaiAsPromised)
Debug.enable()

describe('hooks', () => {
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
    const result = await hook(nested(57, 10))
    assert.strictEqual(result.reduction.id, 57)
    assert.strictEqual(result.requests.length, 10)
  })
  test('nested parallel hooks do not collide', async () => {
    // make many simultaneous calls, and ensure none of them throw an error, and all return correct data
    const inits = Array(4).fill(true)
    const nestedDepth = 4
    const awaits = inits.map((_, index) => {
      return hook(nested(index, nestedDepth))
    })
    const results = await Promise.all(awaits)
    assert(results.every(({ reduction: { id } }, index) => id === index))
  })
  test('reduction must be an object', async () => {
    await assert.isRejected(hook(() => () => 'this is a function'))
    await assert.isRejected(hook(() => true))
    await assert.isRejected(hook(() => 'string'))
  })
  test('duplicate requests rejected in same call', async () => {
    const double = async () => {
      interchain('twin')
      interchain('twin')
      // TODO supply a response, and verify the second request gets a different response
      return {}
    }
    await assert.isRejected(hook(double))
  })
  test.todo('duplicate requests permitted in different calls')
})
