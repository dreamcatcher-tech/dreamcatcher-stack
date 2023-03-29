import { Interpulse, Syncer } from '..'
import Debug from 'debug'
import { apps } from '../../index.mjs'
import assert from 'assert-fast'
const debug = Debug('tests')

describe('Syncer', () => {
  afterEach(async () => {
    const _engines = [...engines]
    engines.length = 0
    await Promise.all(_engines.map((e) => e.stop()))
  })
  const engines = []

  test('app error inducer', async () => {
    const server = await Interpulse.createCI({
      ram: true,
      overloads: { '/crm': apps.crm.covenant },
    })
    const config = { isPublicChannelOpen: true }
    await server.add('app', { covenant: '/crm', config })
    await server.serve('/app')
    const id = await server.getIdentifiers('/app')
    const { chainId, peerId, multiaddrs } = id

    const client = await Interpulse.create({
      ram: true,
      overloads: { '/crm': apps.crm.covenant },
    })
    engines.push(server, client)

    await client.peer(chainId, peerId)
    await client.multiaddr(multiaddrs[0])
    await client.mount('server', chainId)

    const { pulseResolver, covenantResolver, api } = client
    const chroot = '/.mtab/server'
    const pulseBuffer = []
    const pulseDrain = async () => {
      for await (const latest of client.subscribe('/.mtab/server')) {
        debug('latest', latest)
        pulseBuffer.push(latest)
      }
    }
    pulseDrain()

    await client.latest('/.mtab/server/customers')
    const syncer = Syncer.create(pulseResolver, covenantResolver, api, chroot)
    const crispStream = syncer.subscribe()
    while (pulseBuffer.length) {
      const latest = pulseBuffer.shift()
      await syncer.update(latest)
    }
    const loadedCrisp = await lastAvailable(crispStream)
    assert(loadedCrisp)

    const { add } = await client.actions('/.mtab/server/customers')
    await add({ formData: { name: 'bob' } })
    while (pulseBuffer.length) {
      const latest = pulseBuffer.shift()
      syncer.update(latest)
      await lastAvailable(crispStream)
    }
    let crisp = await lastAvailable(crispStream)
    while (!crisp.isDeepLoaded) {
      crisp = await lastAvailable(crispStream)
    }
    assert(crisp.isDeepLoaded)
    assert(crisp.getChild('customers').hasChild('1'))
  })
  const lastAvailable = async (stream) => {
    let last
    let count = 0
    do {
      last = (await stream.next()).value
      count++
    } while (stream.readableLength)
    debug('waiting', count)
    return last
  }

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
    const { pulseResolver, covenantResolver, api } = client
    const syncer = Syncer.create(pulseResolver, covenantResolver, api)
    const pulseDrain = async () => {
      for await (const latest of client.subscribe('/.mtab/server')) {
        debug('latest', latest)
        syncer.update(latest)
      }
    }
    pulseDrain()
    let nested1First
    const subscriber = async () => {
      for await (const crisp of syncer.subscribe()) {
        if (!crisp.isLoading) {
          debug('crisp', crisp.path, crisp.pulse)
        }
        if (crisp.isDeepLoaded) {
          const nested1 = crisp.getChild('nested1')
          debug('n1', nested1.pulse)
          if (!nested1First) {
            nested1First = nested1.pulse
          }
          if (nested1.pulse !== nested1First) {
            debug('n1First %s n1.pulse %s', nested1First, nested1.pulse)
            return
          }
        }
      }
    }
    const end = subscriber()
    debug('pinging')
    await client.latest('/.mtab/server/nested1')
    const ping = await client.ping('/.mtab/server/nested1')
    expect(ping).toBeTruthy()
    debug('ping complete')
    return end
  })
})
const assertAllLoaded = (crisp) => {
  assert(crisp.isDeepLoaded, `crisp ${crisp.path} is not deep loaded`)
  assert(!crisp.isLoading, `crisp ${crisp.path} is loading`)
  assert(!crisp.isLoadingChildren, `crisp ${crisp.path} is loading children`)
  crisp.sortedChildren.forEach((path) => {
    const child = crisp.getChild(path)
    assertAllLoaded(child)
  })
}
