import { Request, Channel, Dmz, Provenance, Pulse, Address } from '..'

describe('Pulse', () => {
  test('basic', async () => {
    const provenance = Provenance.createGenesis()
    const pulse = await Pulse.create(provenance).crush()
    const address = Address.generate(pulse)

    const channel = Channel.create(address)
    const request = Request.create('TEST')

    const network = pulse.provenance.dmz.network.setChannel('child', channel)
    // make a genesis pulse
    // make it transmit something
    // have it received by a remote pulse
  })
  test.todo('softpulse for pooling')
})
