import { Interpulse, Syncer } from '..'
import Debug from 'debug'
const debug = Debug('tests')

describe('Syncer', () => {
  afterEach(async () => {
    const _engines = [...engines]
    engines.length = 0
    await Promise.all(_engines.map((e) => e.stop()))
  })
  const engines = []

  test('writing to a deep path', async () => {
    const server = await Interpulse.createCI({ ram: true })
    await server.add('child1', { config: { isPublicChannelOpen: true } })
    await server.add('child1/nested1')
    await server.serve('/child1')
    const id = await server.getIdentifiers('/child1')
    const { chainId, peerId, multiaddrs } = id

    const client = await Interpulse.create({ ram: true })
    engines.push(server, client)

    await client.peer(chainId, peerId)
    await client.multiaddr(multiaddrs[0])
    await client.mount('server', chainId)
    await client.latest('/.mtab/server/nested1')
    const { pulseResolver, covenantResolver, api } = client
    const syncer = Syncer.create(pulseResolver, covenantResolver, api)
    const pulseDrain = async () => {
      for await (const latest of client.subscribe('/.mtab/server')) {
        debug('latest', latest)
        syncer.update(latest)
      }
    }
    pulseDrain()
    let n1First
    const subscriber = async () => {
      for await (const crisp of syncer.subscribe()) {
        debug('crisp', crisp.isDeepLoaded)
        if (crisp.isDeepLoaded) {
          const n1 = crisp.getChild('nested1')
          debug('n1', n1.pulse)
          if (!n1First) {
            n1First = n1.pulse
          }
          if (n1.pulse !== n1First) {
            debug('n1First %s n1.pulse %s', n1First, n1.pulse)
            return
          }
        }
      }
    }
    const end = subscriber()
    debug('pinging')
    const ping = await client.ping('/.mtab/server/nested1')
    expect(ping).toBeTruthy()
    debug('ping complete')
    return end
    // how to test if a tear occured and yet syncing still was successful ?
  })
})
