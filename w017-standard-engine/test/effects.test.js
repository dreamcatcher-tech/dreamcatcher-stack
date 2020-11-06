const assert = require('assert')
const debug = require('debug')('interblock:tests:effects')
const { effect, interchain } = require('../../w002-api')
const covenants = require('../../w212-system-covenants')
const { metrologyFactory } = require('..')

describe('effects', () => {
  require('debug').enable('*metro* *tests* *:isolate *:promises *:interpreter')
  jest.setTimeout('500')
  test('non hooked promise throws', () => {
    const reducer = async (state, action) => {
      const wait = 200
      await new Promise((resolve) => setTimeout(resolve, wait))
      return { wait }
    }
  })
  test.only('hooked promise effect', async () => {
    let resolve
    const promise = new Promise((_resolve) => {
      resolve = _resolve
    })
    const fn = () => {
      debug(`fn triggered`)
      return promise
    }

    let result
    const reducer = async (state, action) => {
      result = await effect('WAIT', fn)
      debug(`result: %O`, result)
      return { reducerResult: result }
    }

    const hyper = { ...covenants.hyper, reducer }
    const base = await metrologyFactory('effect', { hyper })
    const nonce = base.pierce({ type: 'NONCE' })
    const testData = { test: 'data' }
    resolve(testData)
    await nonce
    const { state } = base.getState()
    debug(state)
    assert.deepStrictEqual(state.reducerResult, testData)
    // verify that @@io queue showed it exiting correctly
    // verify the io queue in the next block also has the reply in it
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
})
