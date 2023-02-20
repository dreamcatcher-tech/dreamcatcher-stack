import { IpldStruct } from './IpldStruct'
import {
  State,
  Config,
  Pending,
  Interpulse,
  Address,
  Provenance,
  PublicKey,
  Dmz,
  Network,
  PulseLink,
} from '.'
import assert from 'assert-fast'
import { fromString as from } from 'uint8arrays/from-string'
import Debug from 'debug'
const debug = Debug('interblock:models:Pulse')
/**
 type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
 */
export class Pulse extends IpldStruct {
  static classMap = { provenance: Provenance }
  static async createCI(params) {
    const CI = true
    return Pulse.createRoot({ ...params, CI })
  }
  static async createRoot({ CI = false, validators, ...rest }) {
    const network = await Network.createRoot()
    const covenant = 'root'
    const config = Config.createPierced()
    const dmz = Dmz.create({ network, config, covenant, ...rest }, CI)
    // TODO assert the validators are supplied
    const provenance = Provenance.createGenesis(dmz, validators)
    return await Pulse.create(provenance)
  }
  static async create(provenance, resolver) {
    assert(provenance instanceof Provenance)
    assert(!resolver || typeof resolver === 'function')
    const instance = super.clone({ provenance, signatures: [] })
    return await instance.crushToCid(resolver)
  }
  static async createCovenantOverload(covenant) {
    assert.strictEqual(typeof covenant, 'object')
    const CI = true
    // TODO run thru covenant schema checker
    const { name = '', api = {}, installer = {} } = covenant
    const state = { name, api, installer }
    const dmz = Dmz.create({ state, covenant: 'covenant' }, CI)
    const provenance = Provenance.createGenesis(dmz)
    return await Pulse.create(provenance)
  }
  isGenesis() {
    return this.provenance.address.isGenesis()
  }
  isForkGenesis() {
    return this.isGenesis() && !!this.provenance.lineages.length
  }
  async isRoot() {
    const parent = await this.provenance.dmz.network.getParent()
    if (parent) {
      return parent.address.isRoot()
    }
    return false
  }
  addSignature(publicKey, signature) {
    assert(publicKey instanceof PublicKey)
    assert(isFormatCorrect(signature), `unparseable signature: ${signature}`)
    assert(this.provenance.validators.has(publicKey))
    // TODO check the signature is actually valid ?
    const index = this.provenance.validators.indexOf(publicKey)
    assert(!this.signatures[index])
    const signatures = [...this.signatures]
    signatures[index] = signature
    return this.setMap({ signatures })
  }
  getAddress() {
    if (this.provenance.address.isGenesis()) {
      return Address.generate(this)
    }
    return this.provenance.address
  }
  isVerified() {
    if (this.isModified()) {
      return false
    }
    if (this.provenance.address.isGenesis()) {
      assert(this.provenance.validators.publicKeys.length)
      return true
    }
    return this.#isQuorum()
  }
  #isQuorum() {
    const signatureCount = this.signatures.filter((s) => !!s).length
    return signatureCount >= this.provenance.validators.quorumThreshold
  }
  async generateSoftPulse(parent) {
    assert(!this.isModified())
    assert.strictEqual(this.currentCrush, this)
    let next = this
    if (this.isGenesis()) {
      assert(this.isForkGenesis() || !this.provenance.transmissions)
      assert(!this.signatures.length)
      // set our own address
      const address = Address.generate(this)
      next = next.setMap({ provenance: { address } })
      const isRoot = await this.isRoot()
      if (isRoot) {
        assert.strictEqual(parent, undefined)
      } else if (this.isForkGenesis()) {
        next = await next.#forkUp(parent)
      } else {
        next = await next.#resolveGenesisParent(parent)
      }
    }
    // blank the prior transmissions
    let provenance = next.provenance.setLineage(this)
    if (provenance.transmissions) {
      provenance = provenance.delete('transmissions')
    } else {
      assert.strictEqual(provenance.dmz.network.channels.txs.length, 0)
    }
    const precedent = this.getPulseLink()
    const network = await provenance.dmz.network.blankTxs(precedent)
    provenance = provenance.setMap({ dmz: { network } })

    // blank piercings
    if (provenance.dmz.network.piercings) {
      assert(provenance.dmz.config.isPierced)
      const network = provenance.dmz.network.delete('piercings')
      provenance = provenance.setMap({ dmz: { network } })
    }

    next = next.setMap({ provenance, signatures: [] })
    return next
  }
  async deriveForkGenesis(parent, resolver) {
    assert(parent instanceof Pulse)
    assert.strictEqual(typeof resolver, 'function')
    const { validators } = parent.provenance
    const { timestamp } = parent.provenance.dmz
    const dmz = this.provenance.dmz.setMap({ timestamp })
    let provenance = Provenance.createGenesis(dmz, validators)
    const { transmissions } = this.provenance
    if (transmissions) {
      provenance = provenance.setMap({ transmissions })
    }
    provenance = provenance.setLineage(this)
    const next = await Pulse.create(provenance, resolver)
    debug(`forked %s from %s`, next.getAddress(), this.getAddress())
    return next
  }
  async #resolveGenesisParent(parent) {
    assert(parent instanceof Pulse, `parent is not a pulse: ${parent}`)
    assert(!parent.isGenesis())
    const parentAddress = parent.getAddress()
    assert(parentAddress.isRemote())
    const network = await this.getNetwork().resolveParent(parentAddress)
    return this.setNetwork(network)
  }
  async #forkUp(parent) {
    assert(parent instanceof Pulse, `parent not pulse: ${parent}`)
    assert(!parent.isGenesis())
    const address = parent.getAddress()
    assert(address.isRemote())
    debug(`forking %s to have parent %s`, this.getAddress(), address)

    const parentView = await parent.getNetwork().getByAddress(this.getAddress())
    const { precedent: tip } = parentView.tx
    const { tip: precedent } = parentView.rx
    const network = await this.getNetwork().forkUp(address, precedent, tip)
    return this.setNetwork(network)
  }
  async ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    let next = this
    assert(next.isModified())
    const { target, source } = interpulse
    assert(next.getAddress().equals(target))
    let network = next.getNetwork()
    if (!interpulse.tx.isGenesisRequest()) {
      const isChannel = await network.channels.hasAddress(source)
      if (!isChannel) {
        if (this.provenance.dmz.config.isPublicChannelOpen) {
          // TODO require a specific action to be able to open
          // to give the reducer a chance to reject
          debug('public channel to %s from %s', target, source)
          network = await network.connectPublicly(source)
        }
      }
    }

    network = await network.ingestInterpulse(interpulse)
    return next.setNetwork(network)
  }
  getNetwork() {
    return this.provenance.dmz.network
  }
  setNetwork(network) {
    assert(network instanceof Network)
    return this.setMap({ provenance: { dmz: { network } } })
  }
  getPending() {
    return this.provenance.dmz.pending
  }
  setPending(pending) {
    assert(pending instanceof Pending)
    return this.setMap({ provenance: { dmz: { pending } } })
  }
  getPulseLink() {
    return PulseLink.generate(this)
  }
  getState() {
    return this.provenance.dmz.state
  }
  setState(state) {
    assert(state instanceof State)
    return this.setMap({ provenance: { dmz: { state } } })
  }
  getCovenantPath() {
    return this.provenance.dmz.getCovenantPath()
  }
  async addChild(alias, installer) {
    assert(this.isModified())
    assert(typeof alias === 'string')
    assert(alias)
    assert(!alias.includes('/'))
    assert(typeof installer === 'object')
    let network = this.getNetwork()
    if (await network.hasChannel(alias)) {
      throw new Error(`child exists: ${alias}`)
    }
    const config = await this.provenance.dmz.config.increaseEntropy()
    const { entropy } = config
    const next = this.setMap({ provenance: { dmz: { config } } })
    installer = injectEntropy(installer, entropy)
    const pulse = await this.deriveChildGenesis(installer)
    const address = pulse.getAddress()
    network = await network.addChild(alias, address)
    return next.setNetwork(network)
  }
  async insertFork(alias, fork) {
    assert(typeof alias === 'string')
    assert(alias)
    assert(!alias.includes('/'))
    assert(fork instanceof Pulse)
    assert(this.isModified())

    let network = this.getNetwork()
    if (await network.hasChannel(alias)) {
      throw new Error(`child exists: ${alias}`)
    }
    const latest = fork.getPulseLink()
    const childSide = await fork.getNetwork().getParent()
    network = await network.insertFork(alias, latest, childSide)
    return this.setNetwork(network)
  }
  async deriveChildGenesis(installer) {
    assert.strictEqual(typeof installer, 'object')
    if (!genesisCache.has(installer)) {
      const { entropy } = installer.config
      assert.strictEqual(typeof entropy, 'string')
      assert.strictEqual(entropy.length, 46)
      const { timestamp } = this.provenance.dmz
      const { network, ...rest } = installer
      const dmz = Dmz.create({ ...rest, timestamp })
      // TODO what if the validators change during this block creation ?
      const { validators } = this.provenance
      const genesis = Provenance.createGenesis(dmz, validators)
      const pulse = await Pulse.create(genesis)
      genesisCache.set(installer, pulse)
    }
    // TODO test if the cache ever actually gets hit
    return genesisCache.get(installer)
  }
  isNext(next) {
    assert(next instanceof Pulse)
    assert(this.getAddress().equals(next.getAddress()))
    // TODO check lineage
    assert(!this.getPulseLink().equals(next.getPulseLink()))
    return true
  }
}
const genesisCache = new WeakMap()
const injectEntropy = (installer, entropy) => {
  let { config = {} } = installer
  config = { ...config, entropy }
  installer = { ...installer, config }
  return installer
}

const isFormatCorrect = (signature) => {
  try {
    from(signature, 'base36upper')
    return true
  } catch (e) {
    return false
  }
}
