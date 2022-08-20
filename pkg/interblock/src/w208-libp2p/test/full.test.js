import { PulseLink, Request } from '../../w008-ipld'
import { PulseNet } from '..'
import Debug from 'debug'
import assert from 'assert-fast'
import { jest } from '@jest/globals'
import { Engine } from '../../w210-engine'
const debug = Debug('interpulse:tests:full')
Debug.enable('*tests* *PulseNet ')

describe('full', () => {
  jest.setTimeout(3000)
  test.only('server with late client', async () => {
    const engine = await Engine.createCI()
    // one node set up
    const server = await PulseNet.createCI()
    debug(server)
    const genesis = engine.latest
    debug('address', genesis.getAddress())
    debug('pulselink', genesis.getPulseLink())
    const address = genesis.getAddress()
    server.endure(genesis)

    const client = await PulseNet.createCI()
    await client.dialCI(server)

    const emitter = client.subscribePulse(address)
    const it = emitter[Symbol.asyncIterator]()

    debug('begin waiting for announcement')
    const { value: p1 } = await it.next()
    assert(p1 instanceof PulseLink)
    debug('emit', p1)
    assert(p1.equals(genesis.getPulseLink()))
    const pulse1 = await client.getPulse(p1)

    await engine.pierce(Request.create('TEST'))
    const next = engine.latest
    debug('begin waiting for announcement')
    server.endure(next)
    const { value: p2 } = await it.next()
    assert(p2 instanceof PulseLink)
    debug('emit', p2)
    assert(p2.equals(next.getPulseLink()))
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
