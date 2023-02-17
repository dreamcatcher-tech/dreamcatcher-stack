import { CID } from 'multiformats/cid'
import { PulseLink, Channel, Pulse } from '../../w008-ipld/index.mjs'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
import { PulseNet } from '../../w305-libp2p'
import Debug from 'debug'
const debug = Debug('interblock:interpulse:NetEndurance')

export class NetEndurance extends Endurance {
  static async create(pulseNet) {
    assert(pulseNet instanceof PulseNet)
    const instance = new NetEndurance()
    instance.#net = pulseNet
    await instance.#start()
    return instance
  }
  #net
  #writePromise = Promise.resolve()
  #writeResolve
  #writeCount = 0
  #writeStart() {
    if (!this.#writeCount) {
      this.#writePromise = new Promise((resolve) => {
        this.#writeResolve = resolve
      })
    }
    this.#writeCount++
  }
  #writeStop() {
    this.#writeCount--
    if (!this.#writeCount) {
      this.#writeResolve()
      this.#writeResolve = undefined
      this.#writePromise = Promise.resolve()
    }
  }
  async #start() {
    // TODO retransmit the tx's of latest pulse
    const { repo } = this.#net
    assert(!repo.closed)
    const config = await repo.config.getAll()
    if (config.latest) {
      const pulselink = PulseLink.parse(config.latest)
      const latest = await this.recover(pulselink)
      await super.endure(latest) // acts like the bootstrap pulse
    }
  }
  async endure(latest) {
    let isBootstrapPulse = !this.selfAddress
    await super.endure(latest)
    this.#writeStart()
    const netEndurePromise = this.#net.endure(latest)
    debug(`start ipfs put`, latest.getPulseLink())
    netEndurePromise
      .then(() => {
        debug(`finish net endure`, latest.getPulseLink())
        this.#writeStop()
      })
      .then(() => this.#transmit(latest))
    if (isBootstrapPulse || this.selfAddress.equals(latest.getAddress())) {
      const pulselink = latest.getPulseLink().cid.toString()
      this.#net.repo.config.set('latest', pulselink)
    }
    return netEndurePromise
  }
  async #transmit(source) {
    assert(source instanceof Pulse)
    assert(source.isVerified())
    const network = source.getNetwork()
    const awaits = network.channels.txs.map(async (channelId) => {
      const channel = await network.channels.getChannel(channelId)
      const { address: target } = channel
      assert(target.isRemote())
      const isLocal = await this.#isLocal(channel, source)
      if (!isLocal) {
        const { path, root } = await this.#remotePath(channel)
        // TODO handle path changing in mtab
        assert(source instanceof Pulse)
        assert(root instanceof Pulse)
        assert.strictEqual(typeof path, 'string')
        // root address is so we know what peers to talk to
        // root pulselink is to prove we had a valid path at time of sending
        // path is so the server can recover the latest pulse from its kv store
        // pulse is to form the interpulse out of
        // target is to know which address to focus the interpulse upon
        debug(
          'transmit',
          source.getPulseLink(),
          target,
          root.getPulseLink(),
          path
        )
        return this.#net.announce(source, target, root, path)
      }
    })
    await Promise.all(awaits)
    debug('transmit complete', source.getAddress(), source.getPulseLink())
  }
  async #isLocal(toChannel, fromPulse) {
    assert(toChannel instanceof Channel)
    assert(fromPulse instanceof Pulse)
    assert(toChannel.aliases.length === 1, `remodel aliasing not supported`)
    const [alias] = toChannel.aliases
    if (isMtab(fromPulse)) {
      // TODO move to using aliases sychronously
      const isHardlink = await fromPulse.getNetwork().hardlinks.has(alias)
      if (isHardlink) {
        return false
      }
    }
    // else if the channel alias goes thru mtab, then is remote
    // TODO safer to work off the full supervisor path using whoami()
    if (alias.startsWith('.mtab/')) {
      return false
    }
    return true
    // TODO investigate using validator check on the destination pulse
    // because the interpulse would send back validators anyway
    // if there is a tip, we could read this from there
    // so connect might send back the first pulselink too
  }
  async #remotePath(channel) {
    // if this is a child, then it must be a child of mtab
    // else, it will go thru mtab
    assert(channel instanceof Channel)
    const [alias] = channel.aliases
    if (!alias.includes('/')) {
      // we must be talking to the channel directly

      const root = await this.recover(channel.rx.latest)
      return { path: '/', root }
    }
    assert(alias.startsWith('.mtab/'), `invalid alias: ${alias}`)

    const mtab = await this.latestByPath('.mtab')

    channel.dir()
  }
  async recover(pulselink) {
    const result = await super.recover(pulselink)
    if (result) {
      return result
    }
    return await this.#net.getPulse(pulselink)
  }
  getResolver(treetop) {
    assert(CID.asCID(treetop))
    const netResolver = this.#net.getResolver(treetop)
    const resolver = super.getResolver(treetop)
    // TODO WARNING permissions must be honoured
    // TODO use treetop to only fetch things below this CID
    return async (cid) => {
      const result = await resolver(cid)
      if (result) {
        return result
      }
      return await netResolver(cid)
    }
  }
  async stop() {
    super.stop()
    await this.#writePromise
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
}
const isMtab = (pulse) => {
  assert(pulse instanceof Pulse)
  return pulse.getCovenantPath() === '/system:/net'
}
