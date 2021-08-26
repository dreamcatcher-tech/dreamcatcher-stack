import { assert } from 'chai/index.mjs'
import { _hook as hook, interchain, useBlocks } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:queries')

describe('queries', () => {
  test('settle after query', async () => {
    const mockBlock = { mock: 'block' }
    let queryResult
    const reducer = async () => {
      debug(`reducer`)
      interchain('TEST1', { test1: 'fakeDestination' })
      queryResult = await useBlocks()
      debug(`queryResult: `, queryResult)
      interchain('TEST2', { test2: 'fakeDestination' })
      return { test3: 'state' }
    }
    const queries = async (query) => {
      await Promise.resolve()
      debug(`query: `, query)
      return mockBlock
    }
    const result = await hook(reducer, [], 'salt', queries)
    const { isPending, requests, replies } = result
    assert(!isPending, `not isPending`)
    assert.strictEqual(requests.length, 2)
    assert.strictEqual(replies.length, 0)
    assert.strictEqual(requests[0].type, 'TEST1')
    assert.strictEqual(requests[1].type, 'TEST2')
    assert.strictEqual(queryResult, mockBlock, 'block error')
  })
  test('query throws cause rejection', async () => {
    let isThrown = false
    const reducer = async () => {
      try {
        await useBlocks()
      } catch (e) {
        isThrown = true
      }
      return {}
    }
    const queries = async (query) => {
      await Promise.reject('test rejection')
    }
    await hook(reducer, [], 'salt', queries)
    assert(isThrown)
  })
})
