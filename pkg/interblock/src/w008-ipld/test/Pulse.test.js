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

let previousLabel
const timer = (label) => {
  if (previousLabel) {
    console.timeEnd(previousLabel)
  }
  if (label) {
    console.time(label)
  }
  previousLabel = label
}

describe('Pulse', () => {
  setCiTimestamp()
  test('basic', async () => {
    let pulse = await Pulse.createCI()
    pulse = await pulse.crush()
    const address = Address.generate(pulse)
    expect(address.cid).toMatchSnapshot()
  })
  test('birth child', async () => {
    timer('create CI')
    let parent = await Pulse.createCI()
    timer('recrush')
    parent = await parent.crush()
    timer()
    const config = { entropy: { seed: 'test' } }
    let { dmz } = parent.provenance
    dmz = await dmz.addChild('child1', { config })
    timer('softpulse')
    parent = await parent.generateGenesisSoftPulse()
    parent = parent.setMap({ provenance: { dmz } })
    timer('crush')
    // when we modify it, it should point the provenance at the previous
    parent = await parent.crush()
    timer()
    assert.throws(() => Address.generate(parent), 'must be genesis')
    timer('keypair')
    const keypair = Keypair.createCI()
    timer('sign')
    let signature = await keypair.sign(parent.provenance)
    timer('add sig')

    assert(!parent.isVerified())
    parent = parent.addSignature(keypair.publicKey, signature)
    assert(!parent.isVerified())
    parent = await parent.crush()
    assert(parent.isVerified())
    timer()

    // generate a genesis pulse using the params in the action
    const { channels } = parent.provenance.dmz.network
    assert.strictEqual(channels.txs.length, 1)
    const [childChannelId] = channels.txs
    const tx = await channels.getTx(childChannelId)
    assert(tx.isGenesisRequest())
    const { validators } = parent.provenance
    const { timestamp } = parent.provenance.dmz
    let child = await tx.extractChildGenesis(validators, timestamp)
    assert(child.isGenesis())
    const { publicKeys } = child.provenance.validators
    assert.strictEqual(publicKeys.length, 1)
    assert.deepEqual(publicKeys[0], keypair.publicKey)
    const channel = await channels.getChannel(childChannelId)
    assert(channel.address.equals(child.getAddress()))

    // reply to the parents action with a signed block
    child = await child.generateGenesisSoftPulse(parent)
    let interpulse = Interpulse.extract(parent, child.getAddress())
    child = await child.ingestInterpulse(interpulse)

    const rxRequest = await child.getNetwork().rxSystemRequest()
    assert.strictEqual(rxRequest.type, '@@GENESIS')
    assert.strictEqual(rxRequest.channelId, 0)
    assert.strictEqual(rxRequest.stream, 'system')
    assert.strictEqual(rxRequest.index, 0)

    // default reply to the request in the child
    let childParentChannel = await child.getNetwork().getParent()
    assert(!childParentChannel.rx.system.isEmpty())
    const network = await child.getNetwork().txSystemReply()
    childParentChannel = await network.getParent()
    assert(childParentChannel.rx.system.isEmpty())
    assert.strictEqual(childParentChannel.tx.system.replies.length, 1)
    assert.strictEqual(network.channels.txs.length, 1)
    assert.strictEqual(network.channels.rxs.length, 0)
    child = child.setNetwork(network)

    // then send it back to the parent
    child = await child.crush()
    signature = await keypair.sign(child.provenance)
    child = child.addSignature(keypair.publicKey, signature)
    child = await child.crush()
    interpulse = Interpulse.extract(child, parent.getAddress())

    parent = await parent.ingestInterpulse(interpulse)
    const rxReply = await parent.getNetwork().rxSystemReply()
    assert.strictEqual(rxReply.type, '@@RESOLVE')
    expect(rxReply).toMatchSnapshot()

    const parentNetwork = await parent.getNetwork().shiftSystemReply()
    parent = parent.setNetwork(parentNetwork)
    parent = await parent.crush()
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
