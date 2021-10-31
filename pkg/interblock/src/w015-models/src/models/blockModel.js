import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { provenanceModel } from './provenanceModel'
import { dmzModel } from './dmzModel'
import { interblockModel } from './interblockModel'
import { publicKeyModel } from './publicKeyModel'
import Debug from 'debug'
const debug = Debug('interblock:models:block')
const dmzSchema = dmzModel.schema

const schema = {
  ...dmzSchema,
  title: 'Block',
  //   description: `The fundamental unit of state persistence and transmission
  // A DMZ with a 'provenance' key is a block.`,
  required: [...dmzSchema.required, 'provenance'],
  properties: {
    ...dmzSchema.properties,
    provenance: provenanceModel.schema,
  },
}
const checkSignatures = (validators, provenance) => {
  const requiredPublicKeys = Object.values(validators)

  const isPierce =
    requiredPublicKeys[0].algorithm === '@@pierce' &&
    requiredPublicKeys.length === 1 &&
    !provenance.signatures.length

  const providedPublicKeys = provenance.signatures.map(
    (signature) => signature.publicKey
  )
  const isAllRequired = requiredPublicKeys.every((key) =>
    providedPublicKeys.some((providedKey) => providedKey.equals(key))
  )
  const isOnlyRequired = providedPublicKeys.every((key) =>
    requiredPublicKeys.some((requiredKey) => requiredKey.equals(key))
  )
  return { isPierce, isAllRequired, isOnlyRequired }
}
const blockModel = standardize({
  schema,
  create(dmz, forkedLineages = {}) {
    // throw new Error(`Only blockProducer can make new block models`)
    dmz = dmz || dmzModel.create()
    assert(dmzModel.isModel(dmz))
    assert.strictEqual(typeof forkedLineages, 'object')
    const provenance = provenanceModel.create(dmz, forkedLineages)
    const block = blockModel.clone({ ...dmz, provenance })
    return block
  },
  logicize(instance) {
    const isLoop = instance.network.getAliases().some((alias) => {
      const { address } = instance.network[alias]
      return instance.provenance.getAddress().equals(address)
    })
    assert(!isLoop, `Loop detected - use loopback address instead`)
    const { provenance, ...spreadDmz } = instance
    const dmz = dmzModel.clone(spreadDmz)
    const hash = dmz.getHash()
    assert(hash === provenance.dmzIntegrity.hash)
    const { validators } = dmz
    const { isOnlyRequired } = checkSignatures(validators, provenance)
    if (!isOnlyRequired) {
      throw new Error('Invalid signatures detected on block')
    }

    const isVerifiedBlock = () => {
      if (provenance.address.isGenesis()) {
        return true
      }
      const sigCheck = checkSignatures(validators, provenance)
      const { isPierce, isAllRequired, isOnlyRequired } = sigCheck
      return isPierce || (isAllRequired && isOnlyRequired)
    }

    const getDmz = () => dmz

    /**
     * Used to detect what role should be taken based on a block
     * and a pubkey.
     *
     * @param {*} pubkeys
     * @param {*} _block
     */
    const whoami = (pubkeys, block) => {
      assert(blockModel.isModel(block))
      // return one of PROPOSER, VALIDATOR, WITNESS
      pubkeys.forEach((_pubkey) => {
        const pubkey = publicKeyModel.clone(_pubkey)
        // read the acl in the block
        // seek the key
        // return the highest ranking match
      })
    }

    const isNextBlock = (nextBlock) => {
      // TODO work out validators being succeeded
      const isBlock = blockModel.isModel(nextBlock)
      const isVerifiedBlock = nextBlock.isVerifiedBlock()
      const isProvenance = provenance.isNextProvenance(nextBlock.provenance)
      // TODO check if forked lineage was applied if required
      // TODO check that channels have been emptied, and correct precedent set
      return isBlock && isVerifiedBlock && isProvenance
    }
    const getChainId = () => provenance.getAddress().getChainId()
    const getHeight = () => provenance.height
    const isInterblockAddable = (interblock) => {
      assert(interblockModel.isModel(interblock))
      const address = interblock.provenance.getAddress()
      const channel = instance.network.getChannel(address)
      if (!channel) {
        return false
      }
      // TODO check against tip parameters fully
      // TODO check turnovers
      if (!Number.isInteger(channel.tipHeight)) {
        return true
      }
      return channel.tipHeight < interblock.provenance.height
    }
    return {
      isVerifiedBlock,
      getDmz,
      whoami,
      isNextBlock,
      getChainId,
      getHeight,
      isInterblockAddable,
    }
  },
})

export { blockModel }
