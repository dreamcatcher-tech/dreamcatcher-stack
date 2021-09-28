/**
 * Provides a dispatch function which returns two nested promises,
 * one for when processed, and one for when resolved.
 * It does this by piercing a reducer, breaking isolation, and running
 * this inside an instance of the standard engine.
 *
 * It produces interblocks the same as running a full blockchain,
 * but without the need for crash recovery, isolation, or security.
 * Crash recoverability might be added later.
 *
 * This is how side effects enter chainland.
 * This same principle is applied for SES and other side effect based aws services.
 *
 * The primary purpose is for the client:
 *      All apps consist of some client side UI connected to the shell chain.
 *      There is one client shell chain per session.
 *      Other apps may wrap this shell with additional functionality,
 *      but the user is always modelled as a chain, through which all actions come through.
 *      The default shell is the DOS shell.
 *      Developers use this to install their applications, and to connect their apps.
 *      Admins use this to browse installations and troubleshoot running apps.
 *      Users use this to execute their applications, either directly or wrapped in a UI.
 *
 *      We may build out additional functions for our core apps into the default client.
 *      Client can be 'chroot'ed to focus on a slice of state to function as an application,
 *      by using the 'cd' command.
 *      Client can be set to subscribe to a given path and optionally its children
 *      to stay current, but usually reading on demand is sufficient and recommended.
 *
 *      Provided socket is used to communication with other block producers.
 *      Client marshalls between which block producers the actions will be directed towards,
 *      to allow emulation mode.
 *
 */
import assert from 'assert-fast'
import { metrologyFactory } from '../../w017-standard-engine'
import posix from 'path-browserify'
import { covenantIdModel } from '../../w015-models'
import { tcpTransportFactory } from './tcpTransportFactory'
import * as covenants from '../../w212-system-covenants'
import { netFactory } from './netFactory'
import { socketFactory } from './socketFactory'
import Debug from 'debug'
const debug = Debug('interblock:effector')

const effectorFactory = async (identifier, covenantOverloads = {}) => {
  assert(!covenantOverloads || typeof covenantOverloads === 'object')
  debug(`effectorFactory`)
  covenantOverloads = _inflateOverloads(covenantOverloads)
  // start the net watcher, to reconcile hardware with chainware
  const gateway = {}
  const net = netFactory(gateway)
  const socket = socketFactory(gateway)
  covenantOverloads = {
    ...covenantOverloads,
    net,
    socket,
    hyper: covenants.shell,
  }
  const metrology = await metrologyFactory(identifier, covenantOverloads)
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
    if (absPath === '/') {
      return metro.getState(height)
    }
    return metro.getLatestFromPath(absPath, height)
  }
  const context = () => metro.getContext()
  const base = {
    metro,
    subscribePending, // TODO make this a promise with result
    subscribeBlockstream,
    subscribe,
    actions,
    latest,
    context,
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
    covenant.covenantId = covenantIdModel.create(
      name,
      version,
      language,
      integrity
    )
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
