import assert from 'assert-fast'
import { Timestamp, Keypair, Provenance, Pulse, Address } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:engine:Crypto')

export class CryptoLock {
  #keypair
  #address
  #timestamp
  #resolve
  get timestamp() {
    return this.#timestamp
  }
  get publicKey() {
    return this.#keypair.publicKey
  }
  static async create(address, keypair) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(keypair instanceof Keypair)
    const instance = new this()
    instance.isReleased = new Promise((resolve) => {
      instance.#resolve = resolve
    })
    instance.#keypair = keypair
    instance.#address = address
    instance.#timestamp = Timestamp.create()
    return instance
  }
  release() {
    debug(`release`)
    this.#resolve()
    this.#keypair = undefined
  }
  isValid() {
    if (!this.#keypair) {
      return false
    }
    return true // TODO expire based on timestamp
  }
  async sign(provenance) {
    assert(provenance instanceof Provenance)
    assert(provenance.address.equals(this.#address))
    // TODO assert(provenance.dmz.timestamp.isoDate === this.timestamp.isoDate)
    debug('sign', provenance.address)
    const signature = await this.#keypair.sign(provenance)
    return signature
  }
}
export class Crypto {
  #keypair
  #locks = new Map()
  #counter = 0
  static createCI() {
    return this.create(Keypair.createCI())
  }
  static create(keypair) {
    assert(keypair instanceof Keypair)
    const instance = new Crypto()
    instance.#keypair = keypair
    return instance
  }
  get publicKey() {
    return this.#keypair.publicKey
  }
  async lock(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(this.#keypair, 'No keypair')
    debug('lock', address)
    const chainId = address.getChainId()
    if (!this.#locks.has(chainId)) {
      this.#locks.set(chainId, [])
    }
    const queue = this.#locks.get(chainId)
    const lock = await CryptoLock.create(address, this.#keypair)
    lock.id = this.#counter++
    debug(`lock.id`, lock.id)
    queue.push(lock)

    if (queue.length > 1) {
      const last = queue[queue.length - 2]
      const start = Date.now()
      debug(`queue start length: `, queue.length)
      await last.isReleased
      // TODO update timestamp which might be stale now
      debug(`lock waited: ${Date.now() - start}ms`)
    }
    lock.isReleased.then(() => {
      queue.shift()
      debug(`queue end length: `, queue.length)
      if (!queue.length) {
        debug(`queue empty`)
        this.#locks.delete(chainId)
      }
    })
    return lock
  }
  isValidatable(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const thisKey = this.publicKey.key
    const { publicKeys } = pulse.provenance.validators
    return publicKeys.some(({ key }) => key === thisKey)
  }
  stop() {
    const openCount = this.#locks.size
    assert(!openCount, `Open lock count: ${openCount}`)
    this.#keypair = undefined
  }
}
