import { pushable } from 'it-pushable'
import { Address, PulseLink } from '../../w008-ipld'
import assert from 'assert-fast'
import { Connection } from '../src/Connection'
import { duplexPair } from 'it-pair/duplex'
import Debug from 'debug'
const debug = Debug('test')

let count = 0
const createTestPulselink = () => {
  const address = Address.createCI(`test ${count++}`)
  return PulseLink.createCrossover(address)
}

Debug.enable('*')

describe('Connection', () => {
  test.only('basic', async () => {
    const announce = pushable({ objectMode: true })
    const latests = new Map()
    const east = Connection.create(announce, latests)
    const west = Connection.create(announce, latests)
    const [eastSide, westSide] = duplexPair()
    east.connectStream(eastSide)
    west.connectStream(westSide)

    const cachedPulselink = createTestPulselink()
    const address = Address.createCI('address 1')
    const chainId = address.getChainId()
    debug(`cachedPulselink`, cachedPulselink)
    latests.set(chainId, cachedPulselink)

    east.txSubscribe(chainId)
    {
      const { value: announcement } = await announce.next()
      assert(announcement.latest.equals(cachedPulselink))
      assert(announcement.forAddress.equals(address))
    }
    const announcedPulselink = createTestPulselink()
    assert(!announcedPulselink.equals(cachedPulselink))
    debug(`announcing`, announcedPulselink)
    west.txAnnounce(address, announcedPulselink)
    {
      const { value: announcement } = await announce.next()
      assert(announcement.latest.equals(announcedPulselink))
      assert(announcement.forAddress.equals(address))
    }
  })
})
