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
const covenants = require('../../w212-system-covenants')
const { shell, net: netCov } = covenants
const { addressModel, socketModel } = require('../../w015-models')
const { tcpTransportFactory } = require('./tcpTransportFactory')

const effectorFactory = async (identifier) => {
  debug(`effectorFactory`)
  const metrology = await metrologyFactory(identifier)
  // start the watcher, which maps functions to objects as they are formed
  // if we have a dispatch path, map the functions, else give usable functions like getState
  const effector = {}
  const base = {
    ...metrology,
    _debug: require('debug'), // used to expose debug info in the os
  }
  const functions = {}
  const children = {}
  let covenantId, resolveShellLoaded
  const shellLoaded = new Promise((resolve) => {
    resolveShellLoaded = resolve
  })
  metrology.subscribe(() => {
    const state = metrology.getState()
    const currentCovenant = getCovenant(state)
    if (!currentCovenant.covenantId.equals(covenantId)) {
      covenantId = currentCovenant.covenantId
      debug(`covenantId: %O`, covenantId)
      // wrap all the functions
      if (covenantId.name === 'hyper') {
        // TODO fix nasty cheap workaround
        const mappedActions = mapDispatchToActions(metrology.dispatch, shell)
        Object.assign(functions, mappedActions)
        resolveShellLoaded()
      }
    }

    const children = metrology.getChildren()
    if (!_.isEqual(children)) {
      // check children by their chainId
      // update the base obj for creates and deletes
      // children will take care of their own children, and expose their own functions
      // if childnre have changed, reattach
      // wrap the children in effectors, so they auto detect their functions, and update themselves
    }

    // for each child, wrap in an effector wrapper
    // when running effector, determine covenant, grab the functions, wrap with dispatch
    // later, finesse the functions with what our permissions are
  })
  await shellLoaded
  Object.assign(effector, base, functions, children)

  debug(`effector: %O`, effector)

  await effector.add('net', { covenantId: netCov.covenantId })

  // TODO subscribe to self, and all children, in case children change ?
  // for each new chain, if we have the covenant actions, map them to dispatch

  const emulateAws = async (reifiedCovenantMap) => {
    // TODO kill existing emulator ?
    const aws = await awsFactory('aws')
    // cross over internet
    client.sqsTx.setProcessor(aws.sqsRx.push)
    aws.sqsTx.setProcessor(client.sqsRx.push)

    // ? make shell login to aws ?
  }

  // start the net watcher, to reconcile hardware with chainware

  return effector
}

const getCovenant = ({ covenantId }) => {
  let covenant = covenants.unity
  for (const key in covenants) {
    if (covenants[key].covenantId.equals(covenantId)) {
      assert(covenant === covenants.unity)
      covenant = covenants[key]
    }
  }
  return covenant
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
