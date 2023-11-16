import { Block } from 'multiformats/block'
import { pipe } from 'it-pipe'
import { CID } from 'multiformats/cid'
import { shell } from '../../w212-system-covenants'
import * as apps from '../../w301-user-apps'
import { pushable } from 'it-pushable'
import { Engine, Endurance } from '../../w210-engine'
import { schemaToFunctions } from '../../w002-api'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { PulseNet } from '../../w305-libp2p'
import { NetEndurance } from '../../w305-libp2p/src/NetEndurance'
import { Crypto } from '../../w210-engine/src/Crypto'
import { isBrowser, isNode } from 'wherearewe'
import { CarReader, CarWriter } from '@ipld/car'
import { Address, PulseLink, Pulse } from '../../w008-ipld'
import { createRamRepo } from '../../w305-libp2p'

const debug = Debug('Interpulse')

/**
 * The top level ORM object.
 * Assembles an Engine with all the services it needs to operate.
 *    Where networking is started.
 *    Where multithreading is controlled.
 * Wraps engine with useful functions for devs.
 * Loads the shell to be loaded at the root block.
 * Works with paths, whereas engine works with addresses.
 * Manages subscriptions to remote chains.
 */

export class Interpulse {
  net
  #repo
  #engine
  #endurance
  #crypto
  #subscribers = new Set()
  #actions

  static async createCI(options = {}) {
    options = { ...options, CI: true }
    return this.create(options)
  }
  static async create(options = {}) {
    debug('creating interpulse')
    let overloads = options.overloads ? { ...options.overloads } : {}
    overloads.root = shell
    Object.assign(overloads, apps)
    let { net, crypto, endurance = Endurance.create() } = options
    let { repo, CI } = options
    if (options.ram) {
      if (!repo || typeof repo === 'string') {
        debug('creating ram repo:', repo)
        repo = createRamRepo(repo)
      }
    }
    if (repo) {
      // no repo => no net - storage and network are one 🙏
      const { tcpHost, tcpPort } = options
      net = await PulseNet.create(repo, CI, tcpHost, tcpPort)
      crypto = Crypto.create(net.keypair)
      endurance = await NetEndurance.create(net)
    }
    const opts = { ...options, overloads, crypto, endurance }
    const engine = await Engine.create(opts)

    const instance = new Interpulse(engine)
    instance.#endurance = endurance
    if (repo) {
      instance.net = net
      instance.#repo = repo
      instance.#crypto = crypto
      instance.#watchMtab()
      instance.#watchInterpulses()
    }
    return instance
  }
  constructor(engine) {
    assert(engine instanceof Engine)
    const actions = mapShell(engine)
    Object.assign(this, actions)
    this.#engine = engine
    this.#actions = actions
  }
  get api() {
    return this.#actions
  }
  async pierce(request) {
    return await this.#engine.pierce(request)
  }

  async hal(prompt) {
    // TODO block .HAL from being overwritten in the shell
    let address
    try {
      const hal = await this.current('.HAL')
      address = hal.getAddress()
    } catch (error) {
      const { chainId } = await this.add('.HAL', { covenant: 'ai' })
      address = Address.fromChainId(chainId)
    }
    assert(address, 'no .HAL found')
    const request = { type: 'PROMPT', payload: { prompt } }
    return this.#engine.pierce(request, address)
  }
  async actions(path = '.') {
    if (path === '/') {
      return this.#actions
    }
    try {
      const pulse = await this.current(path)
      const covenantPath = pulse.getCovenantPath()
      const covenantPulse = await this.current(covenantPath)
      const state = covenantPulse.getState().toJS()
      const { api = {} } = state
      const actions = schemaToFunctions(api)
      const dispatches = {}
      for (const key of Object.keys(actions)) {
        dispatches[key] = (...payload) => {
          const action = actions[key](...payload)
          if (pulse.getConfig().isPierced) {
            return this.#engine.pierce(action, pulse.getAddress())
          } else {
            return this.dispatch(action, path)
          }
        }
      }
      return dispatches
    } catch (error) {
      throw new Error(`No actions found at ${path}: ${error.message}`)
    }
  }
  async execute(actionPath, ...payload) {
    if (typeof actionPath !== 'string') {
      assert.strictEqual(Object.keys(payload).length, 0)
      return this.executeConcurrent(actionPath)
    }
    assert.strictEqual(typeof actionPath, 'string')
    debug('execute', actionPath, payload)
    if (!posix.isAbsolute(actionPath)) {
      actionPath = this.wd + '/' + actionPath
    }
    actionPath = posix.normalize(actionPath)
    debug('actionPath normalized to:', actionPath)
    assert(posix.isAbsolute(actionPath))
    const asRoot = actionPath.substring('/'.length)
    if (this[asRoot]) {
      return await this[asRoot](...payload)
    }
    const actions = await this.actions(posix.dirname(actionPath))
    const basename = posix.basename(actionPath)
    if (!actions[basename]) {
      throw new Error(`No action found at ${actionPath}`)
    }
    return await actions[basename](...payload)
  }
  async executeConcurrent(actions) {
    actions = Array.isArray(actions) ? actions : [actions]
    assert(actions.every((action) => typeof action === 'object'))
    await Promise.all(
      actions.map(async (action) => {
        const commands = Object.keys(action)
        await Promise.all(
          commands.map((command) => this.execute(command, action[command]))
        )
      })
    )
  }
  async latest(path = '.') {
    const { wd } = this
    const absPath = posix.resolve(wd, path)
    for await (const pulse of this.#engine.subscribe()) {
      try {
        const latest = await this.#engine.latestByPath(absPath, pulse)
        return latest
      } catch (error) {
        debug('latest error %s %s', absPath, error.message)
      }
    }
    throw new Error(`No pulse found at ${absPath}`)
  }
  /**
   * Get whatever pulse is available in local storage for the given path.
   * Will error if no pulse is available.
   * @param {string} path Path to requested pulse relative to rootPulse
   * @param {Pulse} rootPulse Pulse to be treated as root for the path
   * @returns Pulse
   */
  async current(path = '.', rootPulse) {
    const { wd } = this
    const absPath = posix.resolve(wd, path)
    const latest = await this.#engine.latestByPath(absPath, rootPulse)
    return latest
  }
  get pulseResolver() {
    return (pulseLink, type, abort) =>
      this.#endurance.recover(pulseLink, type, abort)
  }
  get covenantResolver() {
    return (path, abort) => this.latest(path, abort)
  }
  get logger() {
    return this.#engine.logger
  }
  get wd() {
    const { wd = '/' } = this.#engine.selfLatest.getState().toJS()
    return wd
  }
  async hardReset() {
    await this.stop()
    await Interpulse.hardReset(this.#repo)
    if (isBrowser) {
      window.location.reload()
    }
  }
  static async hardReset(repo) {
    if (isBrowser) {
      const dbs = await window.indexedDB.databases()
      const awaits = []
      for (const db of dbs) {
        debug(`deleting`, db)
        const request = window.indexedDB.deleteDatabase(db.name)
        awaits.push(
          new Promise((resolve, reject) => {
            request.onerror = reject
            request.onsuccess = resolve
          }).then(() => debug(`deleted`, db))
        )
      }
      return await Promise.all(awaits)
    }
    if (isNode) {
      if (typeof repo === 'string') {
        debug('deleting directory:', repo)
        const { removeSync } = await import('fs-extra/esm')

        // sync to purposefully block the thread from any block making
        debug('deleting using fs-extra remoteSync')
        removeSync(repo)
        debug('deletion complete')
        return
      }
      debug('repo was not a filesystem path - skipping deletion')
    }
  }
  async scrub() {
    /**
    To ensure the integrity of the system, invoke scrub to
    check the hashes of all objects at this location,
    and to verify the availability of all objects.
    Use the option --history to check all blocks in the past
    as well as LATEST.  This will incur significant usage fees
    and bandwidth.
     */
    throw new Error('not implemented')
  }
  async stop() {
    for (const subscriber of this.#subscribers) {
      subscriber.return()
    }
    await this.#engine.stop() // stop all interpulsing
    await this.net?.stop()
    await this.#crypto?.stop()
    await this.#endurance.stop()
  }
  async stats() {
    if (!this.net) {
      return {}
    }
    return await this.net.stats()
  }
  subscribe(path = '.') {
    // receive a continuous stream of pulses from a given path
    const { wd } = this
    const absPath = posix.resolve(wd, path)
    assert(posix.isAbsolute(absPath), `path must be absolute: ${absPath}`)
    debug('subscribing to', absPath)
    const sink = pushable({
      objectMode: true,
      onEnd: () => {
        debug('unsubscribe', absPath)
        this.#subscribers.delete(sink)
      },
    })
    this.#subscribers.add(sink)
    const rootEmitter = this.#engine.subscribe()
    const checker = async (source) => {
      let prior
      for await (const rootPulse of source) {
        debug('checker pulse %s for %s', rootPulse.getPulseLink(), absPath)
        try {
          const latest = await this.#engine.latestByPath(absPath, rootPulse)
          if (prior?.cid.equals(latest.cid)) {
            continue
          }
          prior = latest
          sink.push(latest)
        } catch (error) {
          debug('subscribe error', path, error.message)
        }
      }
      debug('checker ended')
    }
    pipe(rootEmitter, checker)
    return sink
  }
  async #watchInterpulses() {
    assert(this.net)
    for await (const announcement of this.net.subscribeInterpulses()) {
      // TODO reduce to: source, target, tip, peerIdString
      // since we can load tip, and then walk to get path, then
      // walk to get local latest, even if path changed since
      const { source, target, address, root, path, peerIdString } = announcement
      assert(source instanceof PulseLink)
      assert(target instanceof Address)
      // TODO maybe do not need address if root loads
      assert(address instanceof Address)
      assert(root instanceof PulseLink)
      assert.strictEqual(typeof path, 'string')
      assert.strictEqual(typeof peerIdString, 'string')
      // TODO must make interpulse be genuinely recovered as an interpulse
      const interpulse = await this.#endurance.recoverInterpulse(source, target)
      debug('interpulse for %s from %s', interpulse.target, interpulse.source)

      try {
        // TODO ensure everything in mtab:serve is preloaded
        const rootPulse = await this.#endurance.recover(root)
        assert(rootPulse.getAddress().equals(address))
        const isPathValid = await this.#engine.latestByPath(path, rootPulse)
        assert(isPathValid)
        this.net.addAddressPeer(interpulse.source, peerIdString)
        await this.#engine.interpulse(interpulse)
      } catch (error) {
        debug('watchInterpulses error', error)
      }
    }
    debug('interpulse ended')
  }
  /**
   * get the latest mtab pulse, then:
   *    get the new multi addresses
   *    get the new address mappings
   *    get the new hardlinks
   */
  async #watchMtab() {
    assert(this.net)
    debug('watching mtab')
    const subscribed = new Set()
    const multiaddrsSet = new Set()
    let lastMtab
    const serves = new Map()
    for await (const mtab of this.subscribe('/.mtab')) {
      if (lastMtab) {
        // TODO determine what to unsubscribe and unmap
      }
      const state = mtab.getState().toJS()

      const { serve = {} } = state
      for (const [path, chainId] of Object.entries(serve)) {
        if (serves.has(path)) {
          if (serves.get(path) !== chainId) {
            console.error('path already served', path, chainId)
          }
          continue
        }
        serves.set(path, chainId)
        const latest = await this.current(path)
        this.net.serve(latest)
      }

      const peerIds = Object.keys(state.peers || {})
      for (const peerId of peerIds) {
        const { multiaddrs, chainIds } = state.peers[peerId]
        for (const multiaddr of multiaddrs) {
          if (!multiaddrsSet.has(multiaddr)) {
            multiaddrsSet.add(multiaddr)
            await this.net.addMultiAddress(multiaddr)
          }
        }
        for (const chainId of chainIds) {
          this.net.addAddressPeer(chainId, peerId)
        }
      }

      lastMtab = mtab
      const { hardlinks, channels } = mtab.getNetwork()
      for await (const [, channelId] of hardlinks.entries()) {
        const channel = await channels.getChannel(channelId)
        const { address } = channel
        if (subscribed.has(address.getChainId())) {
          continue
        }
        subscribed.add(address.getChainId())
        debug('subscribing to', address)

        const stream = this.net.subscribePulse(address)
        const updater = async (source) => {
          let prior
          try {
            for await (const pulseId of source) {
              debug('stream %s %s', address, pulseId)
              assert(pulseId instanceof PulseLink)
              // TODO insert syncer here and allow skipping
              // or detach full syncer from mtab
              const latest = await this.#endurance.recoverRemote(pulseId, prior)
              assert(pulseId.equals(latest.getPulseLink()))
              if (prior) {
                assert(prior.equals(latest.provenance.lineages[0]))
              }
              const target = mtab.getAddress()
              debug('updating %s with %s', address, latest)
              await this.#engine.updateLatest(target, latest)
              prior = pulseId
            }
          } catch (error) {
            debug('updater error', error)
          }
          debug('updater ended')
        }
        pipe(stream, updater)
      }
    }
    debug('mtab ended')
  }
  get isCreated() {
    return !this.net || this.net.isCreated
  }
  async export(path = '.') {
    const latest = await this.latest(path)
    debug('exporting', path, latest.getPulseLink())
    const blocks = await this.#inflate(latest)
    const car = await this.#writeCar(latest, blocks)
    return car
  }
  async #writeCar(latest, blocks) {
    assert(latest instanceof Pulse)
    assert(blocks instanceof Map)
    const { writer, out } = await CarWriter.create([latest.cid])
    for (const block of blocks.values()) {
      writer.put(block)
    }
    writer.close()
    return out
  }
  async #inflate(latest) {
    assert(latest instanceof Pulse)
    const blocks = new Map()
    const ipfsResolver = this.#endurance.getResolver(latest.cid)
    const loggingResolver = async (cid) => {
      // TODO merge this with bake and lift walks
      // could start streaming out each time a resolve occurs
      // but ignore duplicates
      const [block] = await ipfsResolver(cid, { noObjectCache: true })
      assert(CID.asCID(block.cid))
      assert(block.value)
      if (!blocks.has(block.cid.toString())) {
        debug('exporting', block.cid.toString())
      }
      blocks.set(block.cid.toString(), block)
      const noObjectCache = new Block(block)
      return [noObjectCache]
    }
    const toExport = [latest.getPulseLink()]
    while (toExport.length) {
      const pulseLink = toExport.shift()
      const instance = await Pulse.uncrush(pulseLink.cid, loggingResolver)
      const network = instance.getNetwork()
      await network.walkHamts({ isBakeSkippable: false })
      for await (const [, channel] of network.channels.list.entries()) {
        if (channel.rx.latest) {
          toExport.push(channel.rx.latest)
        }
      }
    }
    debug('exporting %d blocks', blocks.size)
    return blocks
  }
  async import(carStream) {
    const reader = await CarReader.fromIterable(carStream)
    const count = await this.#endurance.import(reader.blocks())
    let roots = await reader.getRoots()
    assert(roots.every(CID.asCID))
    debug(`imported ${count} blocks in ${roots.length} roots`)
    roots = await Promise.all(
      roots.map(async (cid) => {
        const pulse = await this.#endurance.recover(PulseLink.parse(cid))
        assert(pulse instanceof Pulse)
        return pulse
      })
    )
    return { roots, count }
  }
  async getIdentifiers(path) {
    assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
    const multiaddrs = this.net.getMultiaddrs()
    const { peerId } = this.net.libp2p
    const child = await this.current(path)
    const address = child.getAddress()
    const chainId = address.getChainId()
    return {
      peerId: peerId.toString(),
      multiaddrs,
      chainId,
    }
  }
}
const mapShell = (engine) => {
  const actions = {}
  const api = schemaToFunctions(shell.api)
  for (const key of Object.keys(api)) {
    actions[key] = (...args) => {
      const action = api[key](...args)
      return engine.pierce(action)
    }
    Object.assign(actions[key], api[key])
  }
  const { publish } = actions
  assert(publish)
  actions.publish = (name, covenant = {}, parentPath = '.') => {
    // TODO use the covenant schema to pluck out what is valid
    // or by default strip out any functions

    const noReducers = withoutReducers(covenant)
    return publish(name, noReducers, parentPath)
  }
  Object.assign(actions.publish, api.publish)

  return actions
}
const withoutReducers = (covenant) => {
  const { reducer, ...rest } = covenant
  if (rest.covenants) {
    rest.covenants = { ...rest.covenants }
    for (const key in rest.covenants) {
      rest.covenants[key] = withoutReducers(rest.covenants[key])
    }
  }
  return rest
}
