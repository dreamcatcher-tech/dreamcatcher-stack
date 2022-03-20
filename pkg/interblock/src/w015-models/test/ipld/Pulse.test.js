import { Dmz, Provenance, Pulse } from '../../src/ipld'

describe('Pulse', () => {
  test.only('basic', async () => {
    const provenance = Provenance.createGenesis()
    const pulse = Pulse.create(provenance)
    // make a genesis pulse
    // make it transmit something
    // have it received by a remote pulse
  })
  test.todo('softpulse for pooling')
})
