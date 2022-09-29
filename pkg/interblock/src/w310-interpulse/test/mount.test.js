import { Interpulse } from '..'
import { createRamRepo } from '../../w305-libp2p'
import Debug from 'debug'
import delay from 'delay'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
const debug = Debug('tests')

Debug.enable('tests iplog *PulseNet')

describe('mount', () => {
  test.only('basic', async () => {
    const serverRepo = createRamRepo('server')
    const server = await Interpulse.createCI({ repo: serverRepo })
    const addResult = await server.add('child1')
    debug(addResult)
    const clientRepo = createRamRepo('client')
    const client = await Interpulse.create({ repo: clientRepo })

    await client.net.dialCI(server.net)
    const { peerId } = server.net.libp2p
    const child1 = await server.latest('/child1')
    const address = child1.getAddress()
    debug('child1 address', address)
    client.net.addAddressPeer(address, peerId)
    const child1ChainId = address.getChainId()
    Debug.enable('tests iplog *PulseNet *shell')
    await client.mount(child1ChainId, 'server')
    const l = await client.latest()
    debug('latest state', l.getState().toJS())
    const lnResult = await client.ln('/.mtab/server', 'serverChild1')
    debug(lnResult)
    await delay(200)
    const remote = await client.latest('/serverChild1')
    expect(child1.cid.equals(remote.cid)).toBeTruthy()

    // things to store:
    //    peerId as a friendly name, like hosts file / dns
    //    peerId multiaddrs, so we can connect to the peer
    //    which peers are assosciated with which peerId

    // map address to peerId
    // observe denied access
    // login to gain access
    // mount the chain on the local tree
    // dispatch some commands into it

    await server.stop()
    await client.stop()

    // after restart of client, observe continued access to server/child1
  }, 2000)
})
