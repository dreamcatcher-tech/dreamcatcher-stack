import { Interpulse } from '..'
import { createRamRepo } from '../../w305-libp2p'
import Debug from 'debug'
const debug = Debug('tests')

describe('mount', () => {
  afterEach(async () => {
    await Promise.all(engines.map((e) => e.stop()))
    engines.length = 0
  })
  const engines = []
  test('basic read-only mount', async () => {
    const serverRepo = createRamRepo('server bro')
    const server = await Interpulse.createCI({ repo: serverRepo })
    const addResult = await server.add('child1')
    await server.serve('/child1')
    debug(addResult)
    const clientRepo = createRamRepo('client bro')
    const client = await Interpulse.create({ repo: clientRepo })
    engines.push(client, server)

    await client.net.dialCI(server.net)
    const { peerId } = server.net.libp2p
    const child1 = await server.latest('/child1')
    const address = child1.getAddress()
    debug('child1 address', address)
    client.net.addAddressPeer(address, peerId)
    const child1ChainId = address.getChainId()

    await client.mount('server', child1ChainId)
    await client.ln('/.mtab/server', 'serverChild1')
    const remote = await client.latest('/serverChild1')
    debug('remote', remote)
    expect(child1.cid.equals(remote.cid)).toBeTruthy()

    const nested1 = await server.add('child1/nested1')
    debug(nested1)
    const nestedRemote = await client.latest('/.mtab/server/nested1')
    expect(nested1.chainId).toEqual(nestedRemote.getAddress().getChainId())
    debug('nested1 pulseHash', nestedRemote.getPulseLink())
  })
  test('shell based read-only mount', async () => {
    const serverRepo = createRamRepo('server sro')
    const server = await Interpulse.create({ repo: serverRepo })
    await server.add('child1')
    await server.serve('/child1')
    const clientRepo = createRamRepo('client sro')
    const client = await Interpulse.create({ repo: clientRepo })
    engines.push(client, server)

    const [multiAddress] = server.net.getMultiaddrs()
    debug('server multiAddress', multiAddress)

    const { peerId } = server.net.libp2p
    const child1 = await server.latest('/child1')
    const address = child1.getAddress()
    debug('child1 address', address)
    const chainId = address.getChainId()

    await client.peer(chainId, peerId.toString())
    await client.multiaddr(multiAddress)
    await client.mount('server', chainId)
    const remote = await client.latest('/.mtab/server')
    debug('remote', remote)
    expect(child1.cid.equals(remote.cid)).toBeTruthy()

    const nested1 = await server.add('child1/nested1')
    debug(nested1)
    const nestedRemote = await client.latest('/.mtab/server/nested1')
    expect(nested1.chainId).toEqual(nestedRemote.getAddress().getChainId())
    debug('nested1 pulseHash', nestedRemote.getPulseLink())
  })
  test('writing', async () => {
    const server = await Interpulse.createCI({ ram: true, repo: 'server w' })
    await server.add('child1', { config: { isPublicChannelOpen: true } })
    await server.serve('/child1')
    const id = await server.getIdentifiers('/child1')
    const { chainId, peerId, multiaddrs } = id

    const client = await Interpulse.create({ ram: true, repo: 'client w' })
    engines.push(server, client)

    await client.peer(chainId, peerId)
    await client.multiaddr(multiaddrs[0])
    await client.mount('server', chainId)
    await client.latest('/.mtab/server')
    const ping = await client.ping('/.mtab/server')
    expect(ping).toBeTruthy()
  })
  test('writing to a deep path', async () => {
    const server = await Interpulse.createCI({ ram: true, repo: 'server wd' })
    await server.add('child1', { config: { isPublicChannelOpen: true } })
    await server.add('child1/nested1')
    await server.serve('/child1')
    const id = await server.getIdentifiers('/child1')
    const { chainId, peerId, multiaddrs } = id

    const client = await Interpulse.create({ ram: true, repo: 'client wd' })
    engines.push(server, client)

    await client.peer(chainId, peerId)
    await client.multiaddr(multiaddrs[0])
    await client.mount('server', chainId)
    await client.latest('/.mtab/server/nested1')
    const ping = await client.ping('/.mtab/server/nested1')
    expect(ping).toBeTruthy()
  })
  test('server reload', async () => {
    const serverRepo = createRamRepo('server rl')
    const preServer = await Interpulse.createCI({ repo: serverRepo })
    await preServer.add('child1')
    await preServer.serve('/child1')
    const id = await preServer.getIdentifiers('/child1')
    const { chainId, peerId } = id

    await preServer.stop()
    const server = await Interpulse.createCI({ repo: serverRepo })

    const clientRepo = createRamRepo('client rl')
    const client = await Interpulse.create({ repo: clientRepo })
    engines.push(server, client)

    await client.peer(chainId, peerId)
    await client.multiaddr(server.net.getMultiaddrs()[0])
    await client.mount('server', chainId)
    const remote = await client.latest('/.mtab/server')
    debug('remote', remote)
    const child1 = await server.current('/child1')
    expect(child1.cid.equals(remote.cid)).toBeTruthy()
  })
  test('client auto redial', async () => {
    const repo = createRamRepo('server')
    let server = await Interpulse.createCI({ repo })
    await server.add('child1')
    await server.add('child1/nested1')
    const child1 = await server.current('/child1')
    await server.serve('/child1')
    const id = await server.getIdentifiers('/child1')
    const { chainId, peerId } = id

    const client = await Interpulse.create({ ram: true, repo: 'client' })
    engines.push(client)

    await client.peer(chainId, peerId)
    await client.multiaddr(server.net.getMultiaddrs()[0])
    await client.mount('server', chainId)
    const remote = await client.latest('/.mtab/server')
    expect(child1.cid.equals(remote.cid)).toBeTruthy()

    debug('stopping server')
    const serverPeerId = server.net.libp2p.peerId
    let ping = await client.net.libp2p.ping(serverPeerId)
    debug('ping', ping)
    await server.stop()
    server = await Interpulse.createCI({ repo })
    engines.push(server)

    await client.latest('/.mtab/server/nested1')
    const reping = await client.net.libp2p.ping(serverPeerId)
    debug('reping', reping)
  })
})
