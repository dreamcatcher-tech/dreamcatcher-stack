import { Pulse, PulseLink, Request } from '../../w008-ipld'
import { PulseNet } from '..'
import Debug from 'debug'
import { jest } from '@jest/globals'
import { Engine } from '../../w210-engine'
const debug = Debug('interpulse:tests:interpulse')
describe('announce', () => {
  test('basic', async () => {
    // two nodes dial each other
    // one side is told there is a new interpulse
    // directly connects to the other node using our custom protocol
    // sends it a hint there is an interpulse available
    // checks it didn't send one that is old

    const engine = await Engine.createCI()
    // one node set up
    const server = await PulseNet.createCI()
    debug(server)
    const genesis = engine.selfLatest
    debug('address', genesis.getAddress())
    debug('pulselink', genesis.getPulseLink())
    const address = genesis.getAddress()
    server.endure(genesis)

    const client = await PulseNet.createCI()
    await client.dialCI(server)

    const emitter = client.subscribePulse(address)
    const it = emitter[Symbol.asyncIterator]()
  })
})
