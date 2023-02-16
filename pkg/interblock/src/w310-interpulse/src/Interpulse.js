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
import { NetEndurance } from './NetEndurance'
import { Crypto } from '../../w210-engine/src/Crypto'
import { isBrowser, isNode } from 'wherearewe'
import { CarReader, CarWriter } from '@ipld/car'
import { PulseLink, Pulse } from '../../w008-ipld'
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
    debug('creating interpulse', options)
    let overloads = options.overloads ? { ...options.overloads } : {}
    overloads.root = shell
    Object.assign(overloads, apps)
    // if announcer is inside net, how to trigger on interpulse received ?
    // could connect via Interpulse ?
    let { net, crypto, endurance = Endurance.create(), announce } = options
    let { repo, CI } = options
    if (options.ram) {
      if (repo === undefined) {
        repo = 'ram'
      }
      if (typeof repo === 'string') {
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
      announce = net.announce
    }
    const opts = { ...options, overloads, crypto, endurance, announce }
    const engine = await Engine.create(opts)

    const instance = new Interpulse(engine)
    instance.#endurance = endurance
    if (repo) {
      instance.net = net
      instance.#repo = repo
      instance.#crypto = crypto
      instance.#watchMtab()
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
          return this.dispatch(action, path)
        }
      }
      return dispatches
    } catch (error) {
      throw new Error(`No actions found at ${path}: ${error.message}`)
    }
  }
  async execute(actionPath, ...payload) {
    if (typeof actionPath !== 'string') {
      assert(actionPath === undefined)
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
        debug('latest error', error.message)
      }
    }
    debug('latest search ended')
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
    return (pulseLink) => this.#endurance.recover(pulseLink)
  }
  get covenantResolver() {
    return (path) => this.latest(path)
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
        const { default: rimraf } = await import('rimraf')

        // sync to purposefully block the thread from any block making
        debug('deleting using rimraf.sync')
        rimraf.sync(repo)
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
    if (this.net) {
      this.#crypto.stop()
      await this.#endurance.stop() // complete all disk writes
      await this.net.stop()
    }
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
        debug('checker pulse %s', rootPulse.getPulseLink())
        try {
          const latest = await this.#engine.latestByPath(absPath, rootPulse)
          if (prior?.cid.equals(latest.cid)) {
            continue
          }
          prior = latest
          sink.push(latest)
        } catch (error) {
          debug('error', error.message)
        }
      }
      debug('checker ended')
    }
    pipe(rootEmitter, checker)
    return sink
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
      debug('mtab state', state)
      debug('mtab hash', mtab.cid.toString())

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
          for await (const pulselink of source) {
            debug('stream', pulselink.toString())
            assert(pulselink instanceof PulseLink)
            const latest = await this.#endurance.recover(pulselink)
            const target = mtab.getAddress()
            await this.#engine.updateLatest(target, latest)
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
    const blocks = new Map()
    const ipfsResolver = this.#endurance.getResolver(latest.cid)
    const loggingResolver = async (cid) => {
      const block = await ipfsResolver(cid)
      assert(CID.asCID(block.cid))
      assert(block.value)
      blocks.set(block.cid.toString(), block)
      return block
    }
    const toExport = [latest.getPulseLink()]
    while (toExport.length) {
      const pulseLink = toExport.shift()
      const instance = await this.#endurance.recover(pulseLink)
      await instance.export(loggingResolver)
      const network = instance.getNetwork()
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
