import assert from 'assert-fast'
import { Address, Pulse, PulseLink } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:engine:Hints')
class MockPubsub {
  /**
   * Updates the dht if it receives newer information
   * @param {*} pulse
   */
  publishPulse(pulse) {
    debug(`publishPulse`)
  }
  publishInterpulse() {
    debug(`publishInterpulse`)
  }
}
/**
 * Hints manages transient relationships like 'latest', 'interpulse',
 * and 'softpulse'.  It does this by announcing, listening, and walking
 * the DHT.
 * In tests, announces can be connected together to allow multiple engines
 * to be tested together
 *
 * The hint system consists of three types of hint subsystem:
 *    1. Pulse Announce: whenever a new pulse has been created
 *    2. Pool Announce: whenever a new version of the pool can be processed,
 *       which includes proposals for new blocks
 *    3. Interpulse Announce: when a new Interpulse is available for ingestion
 *
 * Each subsystem is composed of a DHT instance and a PubSub instance.
 * The PubSub is used to send out realtime updates to the DHT, and the DHT
 * is used to persist malleable data, to both catch up if PubSubs are missed,
 * and to recover in the event of a node restart.
 */

export class Hints {
  #self
  #mockLatestDht = new Map()
  #mockInterpulseDht = new Map()
  #mockSoftLatestDht = new Map()
  #mockPubsub = new MockPubsub()
  set self(address) {
    assert(address instanceof Address)
    this.#self = address
  }
  get self() {
    return this.#self
  }

  async pulseLatest(address) {
    // get latest out of dht, using local version first, then remote
    // returns a pulselink
    // TODO use the approot as the only way to retrieve chains?
    assert(address instanceof Address)
    assert(address.isRemote())
    const chainId = address.getChainId()
    const latest = await this.#mockLatestDht.get(chainId)
    debug(`pulseLatest for: ${address} is: ${latest}`)
    return latest
  }
  /**
   * Sets the dht.  Need a different response when a pubsub message is received
   * @param {Pulse} pulse
   */
  async pulseAnnounce(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    const address = pulse.getAddress()
    assert(address.isRemote())

    const chainId = address.getChainId()
    const pulselink = pulse.getPulseLink()
    debug(`pulseAnnounce`, address, pulselink)
    await this.#mockLatestDht.set(chainId, pulselink)
    await this.#pulseSubscriber(pulse)
  }
  #pulseSubscriber
  pulseSubscribe(callback) {
    assert(!this.#pulseSubscriber)
    this.#pulseSubscriber = callback
  }
  /**
   * Tell validators of `remoteAddress` that there is a new transmission
   * waiting for them inside of `pulselink`.  If remoteAddress is part of the
   * same approot, do not announce at all, since the approot change
   * is all that is required - validators will see that, check for changes,
   * and thereby find any interpulses that need to be sent.
   *
   * Interpulses across validator sets should be limited, and should all be
   * tunneled through a single chain.  This reduces the topics on ipfs that need
   * to be tracked.
   *
   * If local, we should send the full pulse ?
   *
   * @param {*} remoteAddress
   * @param {*} pulselink A new pulse that has a transmission for remoteAddress
   *
   * if all remotes are within the same chaincomplex, do not announce
   * if the foreign chain has access to the approot, do not announce
   */
  async interpulseAnnounce(target, source, pulse) {
    assert(target instanceof Address)
    assert(target.isRemote())
    assert(source instanceof Address)
    assert(source.isRemote())
    assert(pulse instanceof Pulse)
    debug('interpulseAnnounce', target, source, pulse)
    // TODO enforce approot announces only
    const key = `${target.getChainId()}_${source.getChainId()}`
    this.#mockInterpulseDht.set(key, pulse.getPulseLink())
  }
  #interpulseSubscriber
  interpulseSubscribe(callback) {
    assert(!this.#interpulseSubscriber)
    this.#interpulseSubscriber = callback
  }
  async poolLatest(address) {
    // the latest softpulse, or pool
    assert(address instanceof Address)
    const chainId = address.getChainId()
    const softPulselink = await this.#mockSoftLatestDht.get(chainId)
    return softPulselink
  }
  async poolAnnounce(pool) {
    // TODO WARNING ensure no conflict with the current soft pulse
    assert(pool instanceof Pulse)
    assert(pool.isModified())
    assert(!pool.isVerified())
    const address = pool.getAddress()
    debug(`poolAnnounce`, address)
    this.#mockSoftLatestDht.set(address.getChainId(), pool)
    // TODO when multivalidator, trigger increase and seek
  }
  async softRemove(address) {
    assert(address instanceof Address)
    const chainId = address.getChainId()
    assert(await this.#mockSoftLatestDht.has(chainId))
    await this.#mockSoftLatestDht.delete(chainId)
  }
  #poolSubscriber
  poolSubscribe(callback) {
    // to get notified when the pool updates, subscribe to this function
    assert(!this.#poolSubscriber)
    this.#poolSubscriber = callback
  }
}
