const assert = require('assert')
const debug = require('debug')('interblock:models:block')
const { standardize } = require('../utils')
const { provenanceModel } = require('./provenanceModel')
const { keypairModel } = require('./keypairModel')
const { dmzModel } = require('./dmzModel')
const { integrityModel } = require('./integrityModel')
const dmzSchema = dmzModel.schema

const schema = {
  ...dmzSchema,
  title: 'Block',
  description: `The fundamental unit of state persistence and transmission
A DMZ with a 'provenance' key is a block.`,
  required: [...dmzSchema.required, 'provenance'],
  properties: {
    ...dmzSchema.properties,
    provenance: provenanceModel.schema,
  },
}

const ciSigner = async (integrity) => {
  const ciKeypair = await keypairModel.create('CI')
  assert(integrityModel.isModel(integrity))
  return ciKeypair.sign(integrity)
}

const blockModel = standardize({
  schema,
  async create(dmz, asyncSigner = ciSigner) {
    debug('create')
    assert(typeof asyncSigner === 'function')

    dmz = dmzModel.clone(dmz)
    // TODO move await out of models and in to the blockProducer
    const previousBlock = undefined
    const forkedLineages = {}
    const provenance = await provenanceModel.create(
      dmz,
      previousBlock,
      forkedLineages,
      asyncSigner
    )
    // TODO verify that we are able to sign this dmz ?
    const block = blockModel.clone({ ...dmz, provenance })
    return block
  },
  logicize(instance) {
    const isLoop = instance.network.getAliases().some((alias) => {
      const { address } = instance.network[alias]
      return instance.provenance.getAddress().equals(address)
    })
    assert(!isLoop, `Loop detected`)
    const { provenance, ...spreadDmz } = instance
    const dmz = dmzModel.clone(spreadDmz)

    const hash = dmz.getHash()
    assert(hash === provenance.dmzIntegrity.hash)

    const isValidated = () => {
      if (provenance.address.isGenesis()) {
        return true
      }
      const { validators } = dmz
      const requiredPublicKeys = Object.values(validators)
      const providedPublicKeys = provenance.signatures.map(
        (signature) => signature.publicKey
      )
      const allRequired = requiredPublicKeys.every((key) =>
        providedPublicKeys.some((providedKey) => providedKey.equals(key))
      )
      const onlyRequired = providedPublicKeys.every((key) =>
        requiredPublicKeys.some((requiredKey) => requiredKey.equals(key))
      )
      return allRequired && onlyRequired
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

    const isNext = (nextBlock) => {
      // TODO work out validators being succeeded
      const blockness = blockModel.isModel(nextBlock) && nextBlock.isValidated()
      const provenance = instance.provenance.isNext(nextBlock.provenance)
      // TODO check if forked lineage was applied if required
      return blockness && provenance
    }
    const getChainId = () => instance.provenance.getAddress().getChainId()
    return { isValidated, getDmz, whoami, isNext, getChainId }
  },
})

module.exports = { blockModel }
