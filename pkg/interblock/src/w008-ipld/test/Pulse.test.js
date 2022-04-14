import { assert } from 'chai/index.mjs'
import {
  Interpulse,
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
    const config = { entropy: { seed: 'test' } }
    let { dmz } = parent.provenance
    dmz = await dmz.addChild('child1', { config })
    parent = parent.generateSoftPulse()
    parent = parent.setMap({ provenance: { dmz } })

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

    // generate a genesis pulse using the params in the action
    const { channels } = parent.provenance.dmz.network
    assert.strictEqual(channels.txs.length, 1)
    const childChannelId = 0
    const tx = await channels.getTx(childChannelId)
    assert(tx.isGenesisRequest())
    const { validators } = parent.provenance
    const { timestamp } = parent.provenance.dmz
    let child = await tx.extractChildGenesis(validators, timestamp)
    assert(child.isGenesis())
    const { publicKeys } = child.provenance.validators
    assert.strictEqual(publicKeys.length, 1)
    assert.deepEqual(publicKeys[0], keypair.publicKey)
    const channel = await channels.getChannel(0)
    assert(channel.address.equals(child.getAddress()))

    // reply to the parents action with a signed block
    child = child.generateSoftPulse(parent.getAddress())
    const interpulse = Interpulse.extract(parent, child.getAddress())
    child = await child.ingestInterpulse(interpulse)
    console.dir(parent, { depth: Infinity })
    console.dir(child, { depth: Infinity })

    const rxRequest = await child.getNetwork().rxSystemRequest()
    assert.strictEqual(rxRequest.type, '@@GENESIS')

    // default reply to the request in the child
    // const network = await child.getNetwork().txSystemReply()
    // then send it back to the parent
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
