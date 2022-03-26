import assert from 'assert-fast'
import { Request, Channel, Dmz, Provenance, Pulse, Address } from '..'

describe('Pulse', () => {
  test('basic', async () => {
    const pulse = await Pulse.create().crush()
    const address = Address.generate(pulse)

    const channel = Channel.create(address)
    const request = Request.create('TEST')
    const { dmz } = pulse.provenance
    assert(dmz instanceof Dmz)

    const network = dmz.network.setChannel('child', channel)
    console.dir(network, { depth: Infinity })
    // make a genesis pulse
    // make it transmit something
    // have it received by a remote pulse
  })
  test.todo('remove transmission')
  test.todo('loopback transmissions')
  test.todo('softpulse for pooling')
  test.todo('genesis pulse')
  test.todo('pierce pulse')
  test.todo('pending')
  test.todo('public connection')
})
