const assert = require('assert')
const debug = require('debug')('interblock:tests:hooks')
const { '@@GLOBAL_HOOK': hook, interchain, effect } = require('..')
describe('hooks', () => {
  //   require('debug').enable('*hooks')
  const nested = (id, depth = 0) => async () => {
    if (depth === 0) {
      return { id }
    } else {
      interchain(`id: ${id} depth: ${depth}`)
      return nested(id, depth - 1)()
    }
  }

  test('nested hooks awaited', async () => {
    const result = await hook(nested(57, 100))
    assert.strictEqual(result.reduction.id, 57)
    assert.strictEqual(result.requests.length, 100)
  })
  test('nested parallel hooks do not collide', async () => {
    // make many simultaneous calls, and ensure none of them throw an error, and all return correct data
    const inits = Array(10).fill(true)
    const nestedDepth = 10
    const awaits = inits.map((_, index) => {
      return hook(nested(index, nestedDepth))
    })
    const results = await Promise.all(awaits)
    assert(results.every(({ reduction: { id } }, index) => id === index))
  })
  test('reduction must be an object', async () => {
    await assert.rejects(hook(() => () => 'this is a function'))
    await assert.rejects(hook(() => true))
    await assert.rejects(hook(() => 'string'))
  })
  test('duplicate requests permitted in same call', async () => {
    const double = async () => {
      interchain('twin')
      await interchain('twin')
      // TODO supply a response, and verify the second request gets a different response
    }
    await hook(double)
  })
  test.todo('duplicate requests permitted in different calls')
  test.todo('__nonce is not present in reply payloads')
  test('__nonce is disallowed from user requests', async () => {
    const badRequest = () => {
      interchain({ type: 'bad', payload: { __nonce: 'not allowed' } })
      return {}
    }
    await assert.rejects(() => hook(badRequest))
  })
})
