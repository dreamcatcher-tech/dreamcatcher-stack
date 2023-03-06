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
const nullRedial = () => {
  throw new Error('nullRedial')
}
describe('Connection', () => {
  test('basic', async () => {
    const update = pushable({ objectMode: true })
    const announce = pushable({ objectMode: true })
    const lifts = pushable({ objectMode: true })
    const latests = new Map()
    const east = Connection.create('peer1', update, announce, lifts, latests)
    const west = Connection.create('peer2', update, announce, lifts, latests)
    const [eastSide, westSide] = duplexPair()
    east.connectStream(eastSide, nullRedial)
    west.connectStream(westSide, nullRedial)

    const cachedPulselink = createTestPulselink()
    const address = Address.createCI('address 1')
    const chainId = address.getChainId()
    debug(`cachedPulselink`, cachedPulselink)
    latests.set(chainId, cachedPulselink)

    east.txSubscribe(chainId)
    {
      const { value: announcement } = await update.next()
      assert(announcement.latest.equals(cachedPulselink))
      assert(announcement.fromAddress.equals(address))
    }
    const announcedPulselink = createTestPulselink()
    assert(!announcedPulselink.equals(cachedPulselink))
    debug(`announcing`, announcedPulselink)
    west.txUpdate(address, announcedPulselink)
    {
      const { value: announcement } = await update.next()
      assert(announcement.latest.equals(announcedPulselink))
      assert(announcement.fromAddress.equals(address))
    }
  })
})
