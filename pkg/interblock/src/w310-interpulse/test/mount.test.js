import { Interpulse } from '..'
import { createRamRepo } from '../../w305-libp2p'
import Debug from 'debug'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
const debug = Debug('tests')

Debug.enable('tests iplog *PulseNet')

describe('mount', () => {
  test.only('basic', async () => {
    const serverRepo = createRamRepo('server')
    const server = await Interpulse.createCI({ repo: serverRepo })
    const result = await server.add('child1')
    debug(result)
    const clientRepo = createRamRepo('client')
    const client = await Interpulse.create({ repo: clientRepo })

    const addrs = server.net.getMultiaddrs()
    debug(addrs)
    await client.net.dialCI(server.net)
    const { peerId } = server.net.libp2p
    const child1 = await server.latest('/child1')
    const address = child1.getAddress()
    debug('child1 address', address)
    client.net.addAddressPeer(address, peerId)
    // map address to peerId
    // observe denied access
    // login to gain access
    // mount the chain on the local tree
    // dispatch some commands into it

    await server.stop()
    await client.stop()
  }, 2000)
})
