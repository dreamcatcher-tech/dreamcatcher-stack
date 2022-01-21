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
    assert(dmz instanceof Dmz)
    assert(dmz.hashString(), `Dmz must be hashable`)
    assert.strictEqual(typeof forkedLineages, 'object')
    const provenance = Provenance.create(dmz, forkedLineages)
    const block = super.create().updateBlock(dmz, provenance)
    return block
  }
  static restore(array) {
    const block = super.restore(array)
    const { provenance, ...dmz } = block.spread()
    block.#dmz = Dmz.create(dmz)
    return block
  }
  hash() {
    throw new Error('Do not raw hash blocks')
  }
  hashString() {
    return this.provenance.reflectIntegrity().hash
  }
  updateBlock(dmz, provenance) {
    assert(dmz instanceof Dmz)
    assert(provenance instanceof Provenance)
    const next = super.update({ ...dmz.spread(), provenance })
    next.#dmz = dmz
    next.#internalAssertLogic()
    return next
  }
  update(obj) {
    assert.strictEqual(typeof obj, 'object')
    assert.strictEqual(Object.keys(obj).length, 0, `Blocks cannot be updated`)
    return super.update(obj)
  }
  #internalAssertLogic() {
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
  _imprint(next) {
    assert(next instanceof Block)
    next.#dmz = this.#dmz
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
    assert(this.#dmz, `dmz not present`)
    return this.#dmz
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
  getState() {
    return this.state.getState()
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
