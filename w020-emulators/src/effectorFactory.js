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
const assert = require('assert')
const { metrologyFactory } = require('../../w017-standard-engine')
const _ = require('lodash')
const debug = require('debug')('interblock:effector')
const { covenantIdModel } = require('../../w015-models')
const { tcpTransportFactory } = require('./tcpTransportFactory')
const covenants = require('../../w212-system-covenants')
const { netFactory } = require('./netFactory')
const { socketFactory } = require('./socketFactory')

const effectorFactory = async (identifier, covenantOverloads = {}) => {
  assert(!covenantOverloads || typeof covenantOverloads === 'object')
  debug(`effectorFactory`)
  covenantOverloads = _inflateCovenants(covenantOverloads)
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
  const shell = effector(metrology, metrology.pierce)
  shell.startNetworking = async () =>
    await shell.add('net', { covenantId: net.covenantId })
  // TODO only have base metro functions, like getEngine, on root
  return shell
}

const effector = (metrology, rootPierce) => {
  const absolutePath = metrology.getAbsolutePath()
  const dispatch = ({ type, payload = {} }, to = absolutePath) => {
    debug(`dispatch to: %o type: %O`, to, type)
    if (absolutePath === '/') {
      return rootPierce({ type, payload })
    }
    const action = covenants.shell.actions.dispatch({ type, payload }, to)
    return rootPierce(action)
  }
  const subscribePending = rootPierce.subscribePending
  const base = {
    ...metrology,
    dispatch,
    subscribePending,
    _debug: require('debug'), // used to expose debug info in the os
  }
  const children = {}
  let covenantId
  const mapFunctions = () => {
    // TODO delete this and move to a dispatch style function
    const state = metrology.getState()
    if (!state) {
      return
    }
    const liveCovenants = metrology.getCovenants()
    let covenant = _getCovenant(state, liveCovenants)
    if (covenant && !covenant.covenantId.equals(covenantId)) {
      covenantId = covenant.covenantId
      debug(`set covenant to: %O`, covenantId.name)
      const mappedActions = mapDispatchToActions(dispatch, covenant)
      stripCovenantActions(base, metrology)
      Object.assign(base, mappedActions)
    }

    const metroChildren = metrology.getChildren()
    if (!isChildrenEqual(metroChildren, children)) {
      stripChildren(base, children)
      for (const key in metroChildren) {
        debug(`creating child: %O`, key)
        children[key] = effector(metroChildren[key], rootPierce)
      }

      // check children by their chainId
      // update the base obj for creates and deletes
      // children will take care of their own children, and expose their own functions
      // if children have changed, reattach
      // wrap the children in effectors, so they auto detect their functions, and update themselves
      Object.assign(base, children)

      // for each child, wrap in an effector wrapper
      // when running effector, determine covenant, grab the functions, wrap with dispatch
      // later, finesse the functions with what our permissions are
      // TODO wrap linked files too, such as remote locations
    }
  }

  mapFunctions()
  metrology.subscribe(mapFunctions)
  return base
}

const isChildrenEqual = (current, previous) => {
  // if we deleted one, or added one
  const currentKeys = Object.keys(current).sort()
  const previousKeys = Object.keys(previous).sort()
  return _.isEqual(currentKeys, previousKeys)
}

const stripChildren = (effector, children) => {
  for (const key in children) {
    delete effector[key]
    delete children[key]
  }
}

const stripCovenantActions = (effector, metrology) => {
  for (const key in effector) {
    if (key === '_debug' || key === 'subscribePending' || metrology[key]) {
      continue
    }
    if (typeof effector[key] === 'function') {
      delete effector[key]
    }
  }
}

const _getCovenant = ({ covenantId }, liveCovenants) => {
  let covenant = covenants.unity
  if (covenantId.name === 'hyper') {
    return liveCovenants.hyper //hyper always overridden
  }
  for (const key in liveCovenants) {
    if (liveCovenants[key].covenantId.equals(covenantId)) {
      assert(covenant === covenants.unity)
      covenant = liveCovenants[key]
      break
    }
  }
  return covenant
}
const _inflateCovenants = (overloads) => {
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
      const covenants = _inflateCovenants(covenant.covenants)
      covenant.covenants = covenants
    }
    models[key] = covenant
  }
  // TODO inflate nested covenants too
  return models
}
const mapDispatchToActions = (dispatch, covenant) => {
  const mappedActions = {}
  if (typeof covenant.actions !== 'object') {
    return mappedActions
  }
  for (const key in covenant.actions) {
    mappedActions[key] = (...args) => {
      const action = covenant.actions[key](...args)
      return dispatch(action)
    }
  }
  return mappedActions
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
module.exports = { effectorFactory }
