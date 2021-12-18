import { mixin } from '../MapFactory'
import { provenanceSchema } from '../schemas/modelSchemas'
import { Provenance, Dmz, Interblock, Validators } from '.'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:classes:Block')

const blockSchema = {
  ...Dmz.schema,
  title: 'Block',
  description: `The fundamental unit of state persistence and transmission
    A DMZ with a valid 'provenance' key is a block.`,
  required: [...Dmz.schema.required, 'provenance'],
  properties: {
    ...Dmz.schema.properties,
    provenance: provenanceSchema,
  },
}
const defaultDmz = Dmz.create()
export class Block extends mixin(blockSchema) {
  #dmz
  static create(dmz = defaultDmz, forkedLineages = {}) {
    // throw new Error(`Only blockProducer can make new block models`)
    assert(dmz instanceof Dmz)
    assert(dmz.hashString(), `Dmz must be hashable`)
    assert.strictEqual(typeof forkedLineages, 'object')
    const provenance = Provenance.create(dmz, forkedLineages)
    // TODO make block be derived from Dmz
    const block = super.create({ ...dmz.spread(), provenance })
    return block
  }
  static clone(params) {
    // TODO try remove need for this method
    return super.create(params)
  }
  assertLogic() {
    const address = this.provenance.getAddress()
    const isLoop = this.network.hasByAddress(address)
    assert(!isLoop, `Loop detected - use loopback address instead`)
    const { validators, provenance } = this
    const dmz = this.getDmz()
    const hash = dmz.hashString()
    assert.strictEqual(hash, provenance.dmzIntegrity.hash, `hash mismatch`)
    const { isOnlyRequired } = checkSignatures(validators, provenance)
    if (!isOnlyRequired) {
      throw new Error('Invalid signatures detected on block')
    }
  }
  isVerifiedBlock() {
    if (this.provenance.address.isGenesis()) {
      return true
    }
    const sigCheck = checkSignatures(this.validators, this.provenance)
    const { isPierce, isAllRequired, isOnlyRequired } = sigCheck
    return isPierce || (isAllRequired && isOnlyRequired)
  }

  getDmz() {
    // TODO intertwine with DMZ deeper than this
    if (!this.#dmz) {
      const { provenance, ...spreadDmz } = this.spread()
      this.#dmz = Dmz.create(spreadDmz)
    }
    return this.#dmz
  }

  /**
   * Used to detect what role should be taken based on a block
   * and a pubkey.
   *
   * @param {*} pubkeys
   * @param {*} _block
   */
  whoami(pubkeys, block) {
    assert(block instanceof Block)
    // return one of PROPOSER, VALIDATOR, WITNESS
    pubkeys.forEach((_pubkey) => {
      // read the acl in the block
      // seek the key
      // return the highest ranking match
    })
  }

  isNextBlock(nextBlock) {
    // TODO work out validators being succeeded
    const isBlock = nextBlock instanceof Block
    const isVerifiedBlock = nextBlock.isVerifiedBlock()
    const isProvenance = this.provenance.isNextProvenance(nextBlock.provenance)
    // TODO check if forked lineage was applied if required
    // TODO check that channels have been emptied, and correct precedent set
    debug({ isBlock, isVerifiedBlock, isProvenance })
    return isBlock && isVerifiedBlock && isProvenance
  }
  getChainId() {
    return this.provenance.getAddress().getChainId()
  }
  getHeight() {
    return this.provenance.height
  }
  isInterblockAddable(interblock) {
    assert(interblock instanceof Interblock)
    const address = interblock.provenance.getAddress()
    const channel = this.network.getByAddress(address)
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
}
const checkSignatures = (validators, provenance) => {
  assert(validators instanceof Validators)
  const requiredPublicKeys = []
  for (const [name, publicKey] of validators.entries()) {
    requiredPublicKeys.push(publicKey)
  }

  const isPierce =
    requiredPublicKeys[0].algorithm === '@@pierce' &&
    requiredPublicKeys.length === 1 &&
    !provenance.signatures.length

  const providedPublicKeys = provenance.signatures.map(
    (signature) => signature.publicKey
  )
  // TODO make a map to do lookups faster
  const isAllRequired = requiredPublicKeys.every((key) =>
    providedPublicKeys.some((providedKey) => providedKey.deepEquals(key))
  )
  const isOnlyRequired = providedPublicKeys.every((key) =>
    requiredPublicKeys.some((requiredKey) => requiredKey.deepEquals(key))
  )
  return { isPierce, isAllRequired, isOnlyRequired }
}
