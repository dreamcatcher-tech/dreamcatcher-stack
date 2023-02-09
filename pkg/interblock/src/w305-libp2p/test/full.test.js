import { Pulse, PulseLink, Request } from '../../w008-ipld'
import { PulseNet, createRamRepo } from '..'
import Debug from 'debug'
import { Engine } from '../../w210-engine'
const debug = Debug('tests')

describe('full', () => {
  test('server with late client', async () => {
    const engine = await Engine.createCI()
    const server = await PulseNet.create(createRamRepo('server'))
    await server.start()
    debug(server)
    const genesis = engine.selfLatest
    debug('address', genesis.getAddress())
    debug('pulselink', genesis.getPulseLink())
    const address = genesis.getAddress()
    await server.endure(genesis)

    const client = await PulseNet.create(createRamRepo('client'))
    await client.start()
    await client.dialCI(server)
    const serverPeerId = await server.keypair.generatePeerId()
    client.addAddressPeer(address, serverPeerId)
    const stream = client.subscribePulse(address)

    debug('begin waiting for announcement')
    const { value: p1 } = await stream.next()
    expect(p1).toBeInstanceOf(PulseLink)
    debug('emit', p1)
    expect(p1.equals(genesis.getPulseLink())).toBeTruthy()
    debug('getting pulse')
    const pulse1 = await client.getPulse(p1)
    debug('got pulse1')
    expect(pulse1).toBeInstanceOf(Pulse)
    expect(pulse1).toEqual(genesis)

    await engine.pierce(Request.create('TEST'))
    const next = engine.selfLatest
    debug('endure next')
    await server.endure(next)
    debug('begin waiting for announcement')
    const { value: p2 } = await stream.next()
    expect(p2).toBeInstanceOf(PulseLink)
    debug('emit', p2)
    expect(p2.equals(next.getPulseLink())).toBeTruthy()

    debug('get pulse2')
    const pulse2 = await client.getPulse(p2)
    debug('got pulse2')
    expect(pulse2).toBeInstanceOf(Pulse)
    expect(pulse2).toEqual(next)
    await Promise.all([server.stop(), client.stop()])
  })
  test('server two clients', async () => { })
  test('server reload', async () => {
    // server and client boot, exchange blocks two ways
    // both shut down to disk
    // boot server, make some new pulses
    // boot client, observe it catch up
  })
})
