import { Interpulse } from '..'
import { createRamRepo } from '../../w305-libp2p'
import Debug from 'debug'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
const debug = Debug('tests')

Debug.enable('tests iplog *PulseNet')

describe('mount', () => {
  test('basic', async () => {
    const serverRepo = createRamRepo('server')
    const server = await Interpulse.createCI({ repo: serverRepo })
    const clientRepo = createRamRepo('client')
    const client = await Interpulse.create({ repo: clientRepo })
    debug('meow')

    // set multiaddresses for peerId
    // map address to peerId
    // observe denied access
    // login to gain access
    // mount the chain on the local tree
    // dispatch some commands into it

    await server.stop()
    await client.stop()
  })
})
