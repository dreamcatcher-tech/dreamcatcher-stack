import { Pulse, PulseLink, Request } from '../../w008-ipld'
import { PulseNet, createRamRepo, NetEndurance } from '..'
import Debug from 'debug'
import { Engine } from '../../w210-engine'
const debug = Debug('tests')

describe('full', () => {
  test('server with late client', async () => {
    const serverEngine = await Engine.createCI()
    const server = await PulseNet.create(createRamRepo('server'))
    const connectToLifter = await NetEndurance.create(server)
    debug(server)
    const genesis = serverEngine.selfLatest
    debug('address', genesis.getAddress())
    debug('pulselink', genesis.getPulseLink())
    const address = genesis.getAddress()
    await server.endure(genesis)
    server.serve(genesis)
    const client = await PulseNet.create(createRamRepo('client'))
    const clientEndurance = await NetEndurance.create(client)
    await client.dialCI(server)
    const serverPeerId = await server.keypair.generatePeerId()
    client.addAddressPeer(address, serverPeerId)
    const pulseStream = client.subscribePulse(address)

    debug('begin waiting for announcement')
    const { value: p1 } = await pulseStream.next()
    expect(p1).toBeInstanceOf(PulseLink)
    debug('emit', p1)
    expect(p1.equals(genesis.getPulseLink())).toBeTruthy()
    debug('getting pulse')
    Debug.enable('tests *PulseNet *Lifter *Connection *NetEndurance')

    const pulse1 = await clientEndurance.recover(p1)
    debug('got pulse1')
    expect(pulse1).toBeInstanceOf(Pulse)
    expect(pulse1).toEqual(genesis)

    await serverEngine.pierce(Request.create('TEST'))
    const next = serverEngine.selfLatest
    debug('endure next')
    await server.endure(next)
    debug('begin waiting for announcement')
    const { value: p2 } = await pulseStream.next()
    expect(p2).toBeInstanceOf(PulseLink)
    debug('emit', p2)
    expect(p2.equals(next.getPulseLink())).toBeTruthy()

    Debug.enable('tests *PulseNet *Lifter *Connection *NetEndurance')
    debug('get pulse2', p2)
    const pulse2 = await clientEndurance.recover(p2)
    debug('got pulse2')
    expect(pulse2).toBeInstanceOf(Pulse)
    expect(pulse2).toEqual(next)
    await Promise.all([server.stop(), client.stop()])
  })
  test.todo('serve two clients')
})
