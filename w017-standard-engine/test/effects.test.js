const assert = require('assert')
const debug = require('debug')('interblock:tests:effects')
const { effect, interchain } = require('../../w002-api')
const covenants = require('../../w212-system-covenants')
const { metrologyFactory } = require('..')

describe('effects', () => {
  require('debug').enable(
    '*metro* *tests*  *:interpreter *:isolator *:increasor'
  )
  jest.setTimeout('500')
  test('non hooked promise throws', () => {
    const reducer = async (state, action) => {
      const wait = 200
      await new Promise((resolve) => setTimeout(resolve, wait))
      return { wait }
    }
  })
  test('hooked promise effect', async () => {
    const testData = { test: 'data' }
    const externalFunction = () => {
      debug(`externalFunction triggered`)
      return Promise.resolve(testData)
    }
    const reducer = async (state, action) => {
      const result = await effect('WAIT', externalFunction)
      debug(`result: %O`, result)
      return { reducerResult: result }
    }

    const hyper = { ...covenants.hyper, reducer }
    const base = await metrologyFactory('effect', { hyper })
    base.enableLogging()
    await base.pierce({ type: 'NONCE' })
    const { state } = base.getState()
    debug(`state:`, state)
    assert.deepStrictEqual(state.reducerResult, testData)
  })
  test('hooked promise to another chain', () => {
    let result
    const payload = { test: 'data' }
    const reducer = async (state, action) => {
      result = await interchain('PING', payload, '..')
      return { innerResult: result }
    }

    assert.deepStrictEqual(result, payload)
  })
  test.todo('inband effect included in block')
  test.todo('effect promise rejection after timeout')
  test.todo('mixture of promise types in the same reducer')
  test.todo('reducer is paused from other actions until promise resolves')
  test.todo('concurrent promises')
  test.todo('timeout rejection of one tick keeps other promises callable')
  test.todo('reduce that uses .then promises should still work')
  test.todo('native promise after hooked promise rejects')
  test.todo('multiple outstanding requests rerun when any one resolves')
  test.todo('a reply triggering a promise throws')
  test.todo('network structure change during pending handled')
  test.todo('promise inducing requeust while pending is honoured after')
  test.todo('removing origin channel during promise unlocks chain')
  test.todo('reply during pending is deduplicated')
  test.todo('covenant rejects origin request from inside covenant')
  // if send a promise out during an await cycle, it should not be overridden at the end
  test.todo('promise from part way thru execution is still honoured')
  test.todo('buffered request is eventually resolved')
  test.todo('buffered request is eventually rejected')
  test.todo('handle promise being returned part way thru pending')
  // have a state machine that invokes two different services one after the other
  test.todo('pending returned during loopback processing works')
  test.todo('parallel state machines awaiting responses')
})
