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

    // get latest pulselink
    // recover the Pulse from the PulseLink
    // test assertions against the pulse
    const pulselink = await engine.mutable.getLatest(engine.address)
  })
  test('override covenants', async () => {
    // engine with overridden custom covenant
  })
  test('reject pierce', async () => {})
})
