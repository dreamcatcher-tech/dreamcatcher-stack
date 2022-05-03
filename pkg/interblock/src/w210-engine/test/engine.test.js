import { jest } from '@jest/globals'
import { assert } from 'chai/index.mjs'
import { Engine } from '..'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:tests:engine')
Debug.enable('*engine')

describe('engine', () => {
  jest.setTimeout(300)
  test('basic', async () => {
    const opts = { CI: true }
    const engine = await Engine.create(opts)
    debug(engine.address)
    expect(engine.address.toString()).toMatchSnapshot()

    const request = Request.create('PING')
    const response = await engine.pierce(request)
    assert.deepEqual(response, {})

    const pulse = engine.latest
    pulse.dir()
    // test assertions against the pulse
  })
  test('override covenants', async () => {
    // engine with overridden custom covenant
  })
  test('reject pierce', async () => {})
})
