import { Pulse } from '../../w008-ipld'
import { PulseNet } from '..'
import Debug from 'debug'
import delay from 'delay'
const debug = Debug('interpulse:tests:full')
Debug.enable('*tests* *PulseNet libp2p:*sub* ')

describe('full', () => {
  test.only('server with late client', async () => {
    // one node set up
    const server = await PulseNet.createCI()
    debug(server)
    const genesis = await Pulse.createCI()
    debug('address', genesis.getAddress())
    debug('pulselink', genesis.getPulseLink())
    const address = genesis.getAddress()

    const result = server.endure(genesis)

    const client = await PulseNet.createCI()
    await client.dialCI(server)

    const emitter = client.subscribePulse(address)
    await delay(500)

    await server.endure(genesis)

    // for await (const pulseLink of client.subscribePulse(address)) {
    //   debug('asdf', pulseLink)
    // }
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
