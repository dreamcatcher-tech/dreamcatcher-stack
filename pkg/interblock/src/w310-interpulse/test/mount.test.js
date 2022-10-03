import { Interpulse } from '..'
import { createRamRepo } from '../../w305-libp2p'
import delay from 'delay'
import Debug from 'debug'
const debug = Debug('tests')

describe('mount', () => {
  afterEach(async () => {
    await Promise.all(engines.map((e) => e.stop()))
    engines.length = 0
  })
  const engines = []
  test('basic', async () => {
    const serverRepo = createRamRepo('server')
    const server = await Interpulse.createCI({ repo: serverRepo })
    const addResult = await server.add('child1')
    debug(addResult)
    const clientRepo = createRamRepo('client')
    const client = await Interpulse.create({ repo: clientRepo })
    engines.push(client, server)

    await client.net.dialCI(server.net)
    const { peerId } = server.net.libp2p
    const child1 = await server.latest('/child1')
    const address = child1.getAddress()
    debug('child1 address', address)
    client.net.addAddressPeer(address, peerId)
    const child1ChainId = address.getChainId()

    await client.mount(child1ChainId, 'server')
    await client.ln('/.mtab/server', 'serverChild1')
    const remote = await client.latest('/serverChild1')
    debug('remote', remote)
    expect(child1.cid.equals(remote.cid)).toBeTruthy()

    Debug.enable('iplog')
    const nested1 = await server.add('child1/nested1')
    debug(nested1)
    const nestedRemote = await client.latest('/.mtab/server/nested1')
    expect(nested1.chainId).toEqual(nestedRemote.getAddress().getChainId())
    debug('nested1 pulseHash', nestedRemote.getPulseLink())
    Debug.enable('*shell iplog *openPath *dmz')
    await client.ping('/.mtab/server')
    await client.ping('/.mtab/server/nested1')

    // things to store:
    //    peerId as a friendly name, like hosts file / dns
    //    peerId multiaddrs, so we can connect to the peer
    //    which peers are assosciated with which peerId

    // dispatch some commands into it

    // after restart of client, observe continued access to server/child1
  })
})
