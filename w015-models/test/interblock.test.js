const assert = require('assert')
const _ = require('lodash')
const {
  dmzModel,
  actionModel,
  networkModel,
  interblockModel,
  blockModel,
  channelModel,
  addressModel,
} = require('..')
const {
  channelProducer: { txRequest },
} = require('../../w016-producers')
require('../../w012-crypto').testMode()

const createBlockWithEffects = async () => {
  const address = addressModel.create('TEST')
  const channel = channelModel.create(address)
  const network = networkModel.create({ effects: channel })
  const opts = { network }
  const dmz = dmzModel.create(opts)
  const validatedBlock = await blockModel.create(dmz)
  return validatedBlock
}

describe('interblock', () => {
  test('create', async () => {
    const validatedBlock = await createBlockWithEffects()
    const interblock = interblockModel.create(validatedBlock, 'effects')
    assert(interblock)
    const clone = interblockModel.clone(interblock)
    assert(clone.equals(interblock))
    assert.throws(interblockModel.clone)
  })
  test('interblock must have validated block', async () => {
    const validatedBlock = await blockModel.create()
    assert.throws(() => interblockModel.create())
    assert(interblockModel.create(validatedBlock))
  })
  test('targetAlias may be empty', async () => {
    const validatedBlock = await blockModel.create()
    const provenanceOnly = interblockModel.create(validatedBlock)
    assert(provenanceOnly)
    assert(!provenanceOnly.network)
  })
  test('lineage only is same whether derived or direct', async () => {
    const block = await createBlockWithEffects()
    const lineage = interblockModel.create(block)
    const heavy = interblockModel.create(block, 'effects')
    assert(heavy.network.effects)
    const derived = heavy.getWithoutRemote()
    const relineage = lineage.getWithoutRemote()
    assert(!lineage.equals(heavy))
    assert(!heavy.equals(derived))
    assert(lineage.equals(derived))
    assert(derived.equals(relineage))
    assert(lineage.equals(relineage))
  })
  test('throws if no valid address to send to', () => {
    // no point making an interblock of the target alias does not have an address
  })
  test('two interblocks from one block', () => {
    // show interblock creation for two different tx chains,
    // from the same original block
    // show the integrity create and check functions are modular
    // check no name leakage inside network key
  })
  test('targetAlias may be empty if network is not', async () => {
    let dmz = dmzModel.create()
    const validatedBlock = await blockModel.create(dmz)
    const provenanceOnly = interblockModel.create(validatedBlock)
    assert(provenanceOnly)
    assert(Object.keys(validatedBlock.network).length)
    assert(!provenanceOnly.network)
  })
  test.todo('proof only has block proof if no network alias')
  test.todo('getTargetAddress handles undefined address in provenance only')
  test('interblock transmit channel tamper detection', async () => {
    const ls = actionModel.create('LS', {})
    const rm = actionModel.create('RM', {})
    const tx = channelModel.create(addressModel.create('TEST'))

    const channelLs = txRequest(tx, ls)
    const network = networkModel.create({ effects: channelLs })
    const opts = { network }
    const dmz = dmzModel.create(opts)
    const validatedBlock = await blockModel.create(dmz)
    const interblock = interblockModel.create(validatedBlock, 'effects')

    const channelRm = txRequest(tx, rm)
    const tamper = { ...interblock, network: { ...interblock.network } }
    tamper.network.effects = channelRm
    assert(interblockModel.clone(interblock))
    assert.throws(() => interblockModel.clone(tamper))
  })
  test.todo('includes')
  test.todo('reject if replies not monotonic ? or promises ?')
})
