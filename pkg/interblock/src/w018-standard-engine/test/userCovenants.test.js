import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '../src/metrologyFactory'
import { shell } from '../../w212-system-covenants'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:covenants')
Debug.enable()

describe('user covenants', () => {
  test('@@INIT', async () => {
    let unreachableReached = false
    const reducer = async (state, action) => {
      debug(action)
      if (action.type === '@@INIT') {
        return state
      }
      unreachableReached = true
    }
    const initter = { reducer }
    const hyper = shell
    const base = await metrologyFactory('init', { hyper, initter })
    base.enableLogging()
    const add = shell.actions.add('test', 'initter')
    const result = await base.pierce(add)
    assert(!unreachableReached)
    await base.settle()
  })
  test.skip('@@INIT cannot return undefined', async () => {
    let unreachableReached = false
    const reducer = async (state, action) => {
      debug(action)
      if (action.type === '@@INIT') {
        return
      }
      unreachableReached = true
    }
    const initter = { reducer }
    const hyper = shell
    const base = await metrologyFactory('init', { hyper, initter })
    base.enableLogging()
    const add = shell.actions.add('test', 'initter')
    await assert.rejects(() => base.pierce(add))
    assert(!unreachableReached)
    await base.settle()
  })
  test.skip('throw on @@INIT', async () => {
    let unreachableReached = false
    const reducer = async (state, action) => {
      debug(action)
      if (action.type === '@@INIT') {
        throw new Error(`@@INIT test`)
      }
      unreachableReached = true
    }
    const thrower = { reducer }
    const hyper = shell
    const base = await metrologyFactory('throw', { hyper, thrower })
    base.enableLogging()
    const add = shell.actions.add('test', 'thrower')
    await assert.rejects(() => base.pierce(add))
    assert(!unreachableReached)
    await base.settle()
  })
})
