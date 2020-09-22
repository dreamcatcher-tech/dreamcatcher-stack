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
const { actions: dmzActions } = require('../../w021-dmz-reducer')
const { shell: shellCov, net: netCov } = require('../../w212-system-covenants')
const { addressModel, socketModel } = require('../../w015-models')
const { tcpTransportFactory } = require('./tcpTransportFactory')

const effectorFactory = async (identifier) => {
  debug(`effectorFactory`)
  const metrology = await metrologyFactory(identifier)
  metrology.spawn('shell', shellCov)
  metrology.spawn('net', netCov)
  await metrology.settle()

  const emulateAws = async (reifiedCovenantMap) => {
    // TODO kill existing emulator ?
    const aws = await awsFactory('aws')
    // cross over internet
    client.sqsTx.setProcessor(aws.sqsRx.push)
    aws.sqsTx.setProcessor(client.sqsRx.push)

    // ? make shell login to aws ?
  }
  const dispatch = ({ type, payload }) => {
    debug(`dispatch action.type: %O`, type)
    const to = 'shell'
    return metrology.dispatch({ type, payload, to })
  }

  const { shell, net: netMetro } = metrology.getChildren()
  // TODO move shell to be /
  const shellActions = mapDispatchToActions(dispatch, shellCov)
  const netChildren = {}
  const _netDispatch = ({ type, payload }) => {
    debug(`_netDispatch action.type: %O`, type)
    const to = 'net'
    return new Promise(async (resolve) => {
      const result = await metrology.dispatch({ type, payload, to })
      // resync the children, since net makes sockets

      resolve(result)
    })
  }

  const netActions = mapDispatchToActions(_netDispatch, netCov)
  Object.assign(netMetro, netActions)
  const net = { ...netMetro }

  const getState = (height, path = []) => {
    // asking with no path will return the "state" key of this actor.
    // asking for any other path will return "state" key of that path
    // throw if we do not have it in the "remote" key of the transmission
    // path may include regex patterns
    const childState = shell.getState(height, path)
    return childState
  }

  const getContext = () => shell.getState(['state', 'xstate', 'context'])
  const subscribe = shell.subscribe
  const { sqsTx, sqsRx } = metrology.getEngine()
  await metrology.settle()
  // start the net watcher, to reconcile hardware with chainware
  return {
    ...shellActions,
    net,
    dispatch,
    getState,
    getContext, // TODO change to use getState with a path ?
    subscribe,
    metrology,
    _debug: require('debug'), // used to expose debug info in the os
  }
  // do the wrapping of children in effector, not metrology ?
}

const resyncNet = async (net, netMetro) => {
  const children = netMetro.getChildren()
  Object.keys(net).forEach(
    (key) => netMetro[key] || children[key] || delete net[key]
  )
  for (const key in children) {
    assert(!netMetro[key], `child overrides function: ${key}`)
    net[key] = await children(key)
  }
  // now need to spread the child reducer functions and wrap over.. ?
}

const mapDispatchToActions = (dispatch, covenant) => {
  const mappedActions = {}
  for (const key in covenant.actions) {
    mappedActions[key] = (...args) => {
      const action = covenant.actions[key](...args)
      return dispatch(action)
    }
  }
  return mappedActions
}

module.exports = { effectorFactory }
