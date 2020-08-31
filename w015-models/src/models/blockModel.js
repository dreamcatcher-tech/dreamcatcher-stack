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
    const forkedLineages = []
    const provenance = await provenanceModel.create(
      dmz,
      previousBlock,
      forkedLineages,
      asyncSigner
    )
    // TODO verify that we are able to sign this dmz ?
    debug('clone')
    const clone = blockModel.clone({ ...dmz, provenance })
    debug('complete')
    return clone
  },
  logicize(instance) {
    debug('logicize')
    const isLoop = instance.network.getAliases().some((alias) => {
      const { address } = instance.network[alias]
      return instance.provenance.getAddress() === address
    })
    assert(!isLoop, `Loop detected`)
    const { provenance, ...copy } = instance
    const dmz = dmzModel.clone(copy)

    const check = (dmz) => {
      const template = integrityModel.create()
      const hash = dmz.getHash()
      const dmzIntegrity = integrityModel.clone({ ...template, hash })
      return dmzIntegrity === instance.provenance.dmzIntegrity
    }
    assert(check(dmz), 'blockModel: provenance check failed')

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
        providedPublicKeys.includes(key)
      )
      const onlyRequired = providedPublicKeys.every((key) =>
        requiredPublicKeys.includes(key)
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

    const isNext = (block) => {
      // TODO work out validators being succeeded
      const blockness = blockModel.isModel(block) && block.isValidated()
      const provenance = instance.provenance.isNext(block.provenance)
      // TODO check if forked lineage was applied if required
      return blockness && provenance
    }
    const getChainId = () => instance.provenance.getAddress().getChainId()
    debug('logicize complete')
    return { isValidated, getDmz, whoami, isNext, getChainId }
  },
})

module.exports = { blockModel }
