import { pushable } from 'it-pushable'
import { Address, PulseLink } from '../../w008-ipld'
import assert from 'assert-fast'
import { Connection } from '../src/Connection'
import Debug from 'debug'
const debug = Debug('test')

let count = 0
const createPulselink = () => {
  const address = Address.createCI(`test ${count++}`)
  return PulseLink.createCrossover(address)
}
describe('Connection', () => {
  test.only('basic', async () => {
    const eastStream = pushable({ objectMode: true })
    const westStream = pushable({ objectMode: true })
    const announce = pushable({ objectMode: true })
    const east = Connection.create(eastStream, westStream, announce)
    const west = Connection.create(westStream, eastStream, announce)

    const pulselink = createPulselink()
    const address = Address.createCI('address 1')
    debug(`announcing`, pulselink)
    west.txAnnounce(address, pulselink)

    east.txSubscribe(address)
    const { value: announcement } = await announce.next()
    debug(announcement)
    assert(announcement.pulselink.equals(pulselink))
    assert(announcement.forAddress.equals(address))
  })
})
