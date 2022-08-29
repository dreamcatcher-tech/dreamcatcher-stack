import { Pulse, PulseLink, Request } from '../../w008-ipld'
import { PulseNet, createRamRepo } from '..'
import Debug from 'debug'
import { jest } from '@jest/globals'
import { Engine } from '../../w210-engine'
const debug = Debug('interpulse:tests:full')

describe('full', () => {
  jest.setTimeout(5000)
  test('server with late client', async () => {
    const engine = await Engine.createCI()
    // one node set up
    const server = await PulseNet.create(createRamRepo('server'))
    debug(server)
    const genesis = engine.latest
    debug('address', genesis.getAddress())
    debug('pulselink', genesis.getPulseLink())
    const address = genesis.getAddress()
    server.endure(genesis)

    const client = await PulseNet.create(createRamRepo('client'))
    await client.dialCI(server)

    const emitter = client.subscribePulse(address)
    const it = emitter[Symbol.asyncIterator]()

    debug('begin waiting for announcement')
    const { value: p1 } = await it.next()
    expect(p1).toBeInstanceOf(PulseLink)
    debug('emit', p1)
    expect(p1.equals(genesis.getPulseLink())).toBeTruthy()
    Debug.enable('*tests* *PulseNet')
    debug('getting pulse')
    const pulse1 = await client.getPulse(p1)
    debug('got pulse1')
    expect(pulse1).toBeInstanceOf(Pulse)
    expect(pulse1).toEqual(genesis)

    await engine.pierce(Request.create('TEST'))
    const next = engine.latest
    debug('begin waiting for announcement')
    server.endure(next)
    const { value: p2 } = await it.next()
    expect(p2).toBeInstanceOf(PulseLink)
    debug('emit', p2)
    expect(p2.equals(next.getPulseLink())).toBeTruthy()

    const pulse2 = await client.getPulse(p2)
    debug('got pulse2')
    expect(pulse2).toBeInstanceOf(Pulse)
    expect(pulse2).toEqual(next)

    it.return()
  })
  test('server two clients', async () => {})
  test('two servers', async () => {})
  test('server reload', async () => {
    // server and client boot, exchange blocks two ways
    // both shut down to disk
    // boot server, make some new pulses
    // boot client, observe it catch up
  })
  test('interpulses', async () => {
    // send a pulse to different clients, verify that interpulse announcements
    // are not triggered unless the client is the target

    for await (const interpulseHint of client.subscribeInterPulse()) {
      // we get these hints coming in from remote validators
      // each one we check, delve into on our side first, then on the remote side
      // the hint is signed, so we can supply it when we ask for the pulse
      // remotely, in case we were misled
    }
  })
})
