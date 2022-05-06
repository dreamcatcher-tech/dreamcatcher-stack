import { jest } from '@jest/globals'
import { assert } from 'chai/index.mjs'
import { Engine } from '..'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
import { actions } from '../../w017-system-reducer'
const debug = Debug('interblock:tests:engine')
Debug.enable('*engine')

describe('engine', () => {
  jest.setTimeout(300)
  test('basic', async () => {
    const engine = await Engine.createCI()
    debug(engine.address)
    expect(engine.address.toString()).toMatchSnapshot()

    const request = Request.create('PING')
    const response = await engine.pierce(request)
    assert.deepEqual(response, {})

    const pulse = engine.latest
    assert.deepEqual(pulse.getNetwork().channels.txs, [2])
  })
  test('multichain', async () => {
    const engine = await Engine.createCI()
    // make a child

    // ping that child
  })
  test('override covenants', async () => {
    // engine with overridden custom covenant
  })
  test('reject pierce', async () => {
    const reducer = () => {
      throw new Error('test reject pierce')
    }
    // ? what format should overloads and covenants be in ?
    const engine = await Engine.createCI()
  })
})
