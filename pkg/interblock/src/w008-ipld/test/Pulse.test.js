import { assert } from 'chai/index.mjs'
import {
  Request,
  Channel,
  Dmz,
  Provenance,
  Pulse,
  Address,
  Config,
  Keypair,
  Validators,
} from '..'
import { setCiTimestamp } from '../src/Dmz'

describe('Pulse', () => {
  setCiTimestamp()
  test('basic', async () => {
    const pulse = await Pulse.create().crush()
    const address = Address.generate(pulse)

    const channel = Channel.create(address)
    const request = Request.create('TEST')
    const { dmz } = pulse.provenance
    assert(dmz instanceof Dmz)

    const network = await dmz.network.setChannel('child', channel)
    console.dir(network, { depth: Infinity })
    // make a genesis pulse
    // make it transmit something
    // have it received by a remote pulse
  })
  test.only('birth child', async () => {
    let parent = await Pulse.createCI().crush()
    const address = Address.generate(parent)
    console.log('parent', address.cid)
    const config = { entropy: { seed: 'test' } }
    let { network } = parent.provenance.dmz
    network = await network.addChild('child1', { config })
    parent = parent.setMap({ provenance: { dmz: { network } } })

    // when we modify it, it should point the provenance at the previous
    parent = await parent.crush()
    assert.throws(() => Address.generate(parent), 'must be genesis')
    const keypair = Keypair.createCI()
    const signature = await keypair.sign(parent.provenance)

    assert(!parent.isVerified())
    parent = parent.addSignature(keypair.publicKey, signature)
    assert(!parent.isVerified())
    parent = await parent.crush()
    assert(parent.isVerified())

    // create child chain using the interpulse
    console.dir(parent, { depth: Infinity })
    // generate a genesis pulse using the params in the action
    const { txs } = parent.provenance.dmz.network.channels
    assert.strictEqual(txs.length, 1)
    const tx = await parent.provenance.dmz.network.channels.getTx(0)
    assert(tx.isGenesisRequest())
    const params = tx.getGenesisParams()
    console.log(params)
    // make the new pulse
    // confirm the hash matches the channel address

    // reply to the parents action

    // blank the parent transmissions
  })
  test.todo('loopback transmissions')
  test.todo('loopback promises')
  test.todo('receive interpulse')
  test.todo('remove transmission')
  test.todo('softpulse for pooling')
  test.todo('genesis pulse')
  test.todo('pierce pulse')
  test.todo('pending')
  test.todo('public connection')
  test.todo('precedent multiple pulses ahead')
})
