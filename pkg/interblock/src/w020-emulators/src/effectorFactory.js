/**
 * Provides a dispatch function which returns two nested promises,
 * one for when processed, and one for when resolved.
 * It does this by piercing a reducer, breaking isolation, and running
 * this inside an instance of the standard engine.
 *
 * It produces interblocks the same as running a full blockchain,
 * but without the need for crash recovery, isolation, or security.
 * Crash recovery is best effort and depends when the database last
 * synced to the filesystem.
 *
 * The primary purpose is for the client:
 *      All apps consist of some client side UI connected to the shell chain.
 *      There is one client shell chain per session.
 *      Other apps may wrap this shell with additional functionality,
 *      The user is always modelled as a chain
 *      The default shell is the DOS shell.
 *      Developers use this to install and connect with their apps.
 *      Admins use this to browse installations and troubleshoot running apps.
 *      Users use this to interact with their applications
 *
 */
import assert from 'assert-fast'
import { metrologyFactory } from '../../w018-standard-engine'
import posix from 'path-browserify'
import { CovenantId } from '../../w015-models'
import { tcpTransportFactory } from './tcpTransportFactory'
import * as covenants from '../../w212-system-covenants'
import { netFactory } from './netFactory'
import { socketFactory } from './socketFactory'
import { createRxdb } from './rxdbFactory'
import Debug from 'debug'
const debug = Debug('interblock:effector')

const effectorFactory = async (id = 'ib', overloads = {}, dbPath = '') => {
  assert.strictEqual(typeof id, 'string', `identifier: ${id}`)
  assert(!overloads || typeof overloads === 'object')
  assert.strictEqual(typeof dbPath, 'string')
  debug(`effectorFactory`)
  overloads = _inflateOverloads(overloads)
  // start the net watcher, to reconcile hardware with chainware
  const gateway = {}
  const net = netFactory(gateway)
  const socket = socketFactory(gateway)
  overloads = {
    ...overloads,
    net,
    socket,
    hyper: covenants.shell,
  }
  const rxdb = await createRxdb(dbPath)
  const metrology = await metrologyFactory(id, overloads, rxdb)
  const shell = effector(metrology)
  shell.startNetworking = async () =>
    await shell.add('net', { covenantId: net.covenantId })
  return shell
}

const effector = (metro) => {
  // TODO use wd or some other fortification against random entries
  const subscribePending = (cb) => metro.pierce.subscribePending(cb)
  const subscribeBlockstream = (chainId, callback) =>
    metro.subscribeBlockstream(chainId, callback)

  /**
   * Subscribe to new blocks in the root chain.
   * The root chain is represented by alias "/".
   * @callback blockCallback
   * @param {block} block the latest block
   */
  /**
   *
   * @param {blockCallback} callback
   * @returns
   */
  const subscribe = (callback) =>
    metro.subscribeBlockstream(metro.getChainId(), callback)

  const actions = async (path = '.') => {
    assert.strictEqual(typeof path, 'string', `path not string: ${path}`)
    const absPath = posix.resolve('/', path)
    debug(`actions`, absPath)
    const actions = await metro.getActionCreators(absPath)
    const dispatch = (action) => shellActions.dispatch(action, absPath)
    return _mapPierceToActions(dispatch, actions)
  }
  const latest = (path = '.', height) => {
    assert.strictEqual(typeof path, 'string', `path not string: ${path}`)
    const absPath = posix.resolve('/', path)
    debug(`latest`, absPath)
    return metro.getLatestFromPath(absPath, height)
  }
  const context = () => metro.getContext()
  const shutdown = () => metro.shutdown()
  const base = {
    metro,
    subscribePending, // TODO make this a promise with result
    subscribeBlockstream,
    subscribe,
    actions,
    latest,
    context,
    shutdown,
    _debug: Debug, // used to expose debug info in dos
  }
  const shellActions = _mapPierceToActions(metro.pierce)
  assert(!Object.keys(shellActions).some((s) => base[s]))
  return { ...base, ...shellActions }
}
const _inflateOverloads = (overloads) => {
  const models = {}
  for (const key in overloads) {
    let covenant = overloads[key]
    assert(typeof covenant === 'object', `Covenant must be an object: ${key}`)
    if (!covenant.covenantId) {
      covenant = { ...covenant, covenantId: { name: key } }
    }
    const { name, version, language, integrity } = covenant.covenantId
    covenant.covenantId = CovenantId.create(name, version, language, integrity)
    if (covenant.covenants) {
      const covenants = _inflateOverloads(covenant.covenants)
      covenant.covenants = covenants
    }
    models[key] = covenant
  }
  // TODO inflate nested covenants too
  return models
}
const _mapPierceToActions = (dispatch, actions = covenants.shell.actions) => {
  const mapped = {}
  for (const key in actions) {
    mapped[key] = (...args) => {
      const action = actions[key](...args)
      return dispatch(action)
    }
  }
  return mapped
}
const connectGateway = (gateway, netEffector) => {
  const { sqsRx, sqsTx } = netEffector.getEngine()
  // address the pierce queue based on the name of the socket
  // ?? just make a socket entry, which handles in and out ?
  gateway.sockets = {
    // accessed directly by each socket chain to send to the socket
  }
  sqsTx.setProcessor(async (tx) => {
    // pierce the socket chain with this transmission
  })
  gateway.receive = (tx) => {
    sqsRx.push(tx)
  }

  gateway.removeSocket = (url) => {}
}
export { effectorFactory }
