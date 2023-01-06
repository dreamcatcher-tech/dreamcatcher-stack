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
import posix from 'path-browserify'
import { fromString as from } from 'uint8arrays/from-string'
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
  static async create(provenance) {
    assert(provenance instanceof Provenance)
    const instance = super.clone({ provenance, signatures: [] })
    return await instance.crushToCid()
  }
  static async createCovenantOverload(covenant) {
    assert.strictEqual(typeof covenant, 'object')
    const CI = true
    // TODO run thru covenant schema checker
    const { name = '', api = {}, installer = {} } = covenant

    const state = { name, api, installer }
    const dmz = Dmz.create({ state }, CI)
    const provenance = Provenance.createGenesis(dmz)
    return await Pulse.create(provenance)
  }
  isGenesis() {
    return this.provenance.address.isGenesis()
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
      assert(!this.provenance.transmissions)
      assert(!this.signatures.length)
      // set our own address
      const address = Address.generate(this)
      next = next.setMap({ provenance: { address } })
      const isRoot = await this.isRoot()
      if (isRoot) {
        assert.strictEqual(parent, undefined)
      } else {
        // must set parent as part of next pulse creation
        assert(parent instanceof Pulse)
        assert(!parent.isGenesis())
        const parentAddress = parent.getAddress()
        assert(parentAddress.isRemote())
        let { network } = next.provenance.dmz
        network = await network.resolveParent(parentAddress)
        next = next.setMap({ provenance: { dmz: { network } } })
      }
    }
    // blank the prior transmissions
    let provenance = next.provenance.setLineage(this)
    if (provenance.transmissions) {
      provenance = provenance.delete('transmissions')
    } else {
      // TODO only allow non transmissions when genesis ?
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

    next = next.setMap({ provenance })
    next = next.setMap({ signatures: [] })
    return next
  }
  async ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    let next = this
    assert(next.isModified())
    const { target } = interpulse
    assert(next.getAddress().equals(target))
    let network = next.getNetwork()
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
    const { covenant } = this.provenance.dmz
    assert.strictEqual(typeof covenant, 'string')
    let covenantPath = covenant
    if (!posix.isAbsolute(covenantPath)) {
      // TODO be precise about assumption this is a system covenant
      covenantPath = '/system:/' + covenantPath
    }
    return covenantPath
  }
  async addChild(alias, installer) {
    // TODO insert repeatable randomness to child
    assert(this.isModified())
    assert(typeof alias === 'string')
    assert(alias)
    assert(!alias.includes('/'))
    assert(typeof installer === 'object')
    let network = this.getNetwork()
    if (await network.hasChild(alias)) {
      // TODO check if the alias exists in symlinks or hardlinks
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
  async deriveChildGenesis(installer) {
    assert.strictEqual(typeof installer, 'object')
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
    return pulse
  }
  isNext(next) {
    assert(next instanceof Pulse)
    assert(this.getAddress().equals(next.getAddress()))
    // TODO check lineage
    assert(!this.getPulseLink().equals(next.getPulseLink()))
    return true
  }
}
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
