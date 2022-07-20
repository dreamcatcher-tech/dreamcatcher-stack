import posix from 'path-browserify'
import assert from 'assert-fast'
import { interchain, useBlocks, useState } from '../../../w002-api'
import Debug from 'debug'
import { Pulse, Request } from '../../../w008-ipld'
import { listChildren } from '../../../w023-system-reducer'
const debug = Debug('interblock:system:shell')

const reducer = async (request) => {
  const { type, payload, binary } = request
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof payload, 'object')
  debug('shell', request.type)
  switch (type) {
    case 'PING': {
      debug(`ping: %O`, payload)
      const { to = '.', ...rest } = payload
      assert.strictEqual(type, 'PING')
      const ping = Request.createPing(rest)
      const result = await interchain(ping, to)
      debug(`ping result: %O`, result)
      return result
    }
    case 'LOGIN': {
      // TODO make this actually work
      // connect to the address given
      // reject if cannot connect or refused
      // attempt to login
      // reject if login refused
      // if pass, return positive result to requester
      debug(`login: %O`, event.payload)
      const { terminalChainId, credentials } = event.payload
      // TODO check terminal regex is a chainId
      const connectToTerminal = connect('terminal', terminalChainId)
      await interchain(connectToTerminal)

      // TODO import from authenticator / terminal functions
      const loginResult = await interchain('@@INTRO', credentials, 'terminal')
      debug(`loginResult: %O`, loginResult)
      return { loginResult }
    }
    case 'ADD': {
      let { alias, spawnOptions } = payload
      assert.strictEqual(typeof alias, 'string')
      assert.strictEqual(typeof spawnOptions, 'object')
      const [{ wd = '/' }] = await useState()
      debug('wd', wd)
      const absolutePath = posix.resolve(wd, alias)
      const to = posix.dirname(absolutePath)
      let basename = posix.basename(absolutePath)
      if (!basename && alias) {
        basename = alias
        debug(`resetting name to ${basename}`)
      }
      debug(`addActor: %O to: %O`, basename, to)
      assert.strictEqual(typeof spawnOptions, 'object')

      const spawnAction = Request.createSpawn(basename, spawnOptions)
      const addActor = await interchain(spawnAction, to)
      debug(`addActor completed %O`, addActor)
      return addActor
    }
    case 'LS': {
      const { path } = payload
      assert.strictEqual(typeof path, 'string')
      const [{ wd = '/' }] = await useState()
      const absPath = posix.resolve(wd, path)
      debug(`listActors`, absPath)
      const pulse = await useBlocks(absPath)
      assert(pulse instanceof Pulse)
      const children = await listChildren(pulse)
      // TODO implement useCovenant to return an inert json object for actions
      // const covenant = await useCovenant(block)

      return { children }
    }
    case 'CD': {
      // TODO ignore if same as working directory
      let { path } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      let [state, setState] = await useState()
      const { wd = '/' } = state
      // TODO implement lockstate
      assert(posix.isAbsolute(wd))
      const absolutePath = posix.resolve(wd, path)
      debug(`changeDirectory`, absolutePath)
      try {
        const pulse = await useBlocks(absolutePath)
        assert(pulse instanceof Pulse)
        debug(`latest`, absolutePath, pulse.getPulseLink())
        state = { ...state, wd: absolutePath }
        await setState(state)
      } catch (error) {
        debug(`changeDirectory error:`, error.message)
        throw error
      }
      return { absolutePath }
    }
    case 'RM': {
      debug(`removeActor`, event)
      // refuse to delete self
      // try open path to child
      return
    }
    case 'DISPATCH': {
      const { action, to } = payload
      const { type, payload: innerPayload } = action
      debug(`dispatch type: %o to: %o`, type, to)
      const result = await interchain(type, innerPayload, to)
      return result
    }
    case 'MV': {
      // move a chain to a new path, which might be on a different root
      // reject if path does not exist, or not accessible
      // allow --merge to perform a merge on the target of the move
      // specify how to reconcile diffs in the objects
      // includes moving a whole tree too
      return
    }
    case 'PUBLISH': {
      // TODO use npm pack to bundle a package up
      // TODO support building images, and displaying progress
      // TODO verify that all covenants in installer are available
      const { name, covenant, parentPath } = payload
      let path = parentPath + '/' + name
      let [{ wd = '/' }] = await useState()
      path = posix.resolve(wd, path)
      debug(`publish: ${name} to: ${parentPath} as`, path)
      const spawnOptions = { covenant: 'covenant', state: covenant }
      const result = await interchain(api.add(path, spawnOptions))
      debug(result)
      return { path }
    }
    case 'CAT': {
      // TODO add flags to get the full pulse, or portions of the state
      const { path } = payload
      let [{ wd = '/' }] = await useState()
      const absolutePath = posix.resolve(wd, path)
      debug(`getState: `, absolutePath)
      const pulse = await useBlocks(absolutePath)
      const state = pulse.getState().toJS()
      debug(`getState result: `, state)
      return state
    }
    case 'COVENANT': {
      const { path } = payload
      let [{ wd = '/' }] = await useState()
      const absolutePath = posix.resolve(wd, path)
      const request = Request.createGetCovenantState(absolutePath)
      const covenantState = await interchain(request)
      // want to get the covenant path, then do useState on it
      return covenantState
    }
    default: {
      throw new Error(`Unrecognized action: ${type}`)
    }
  }
}

/**
 * Basic app structure is:
 * /root
 *      // internally has reference to the dpkg, which holds the covenants and install images
 *      .processes/
 *          // all FSMs and their running threads
 *          // processes change data
 *          // starts with the process of installing
 *          .network/
 *              // the externally presented FSM and types ?
 *      .devices/
 *          // all the devices connected to this application go here
 *          // includes the terminals from the clients
 *      .apps/
 *          // other applications that are part of this one
 *          // probably have to be symlinks ?
 *      // all the data of the application goes here
 *      ping/
 *      pong/
 *
 *
 * Config should not do permissioning of any kind.
 * Assure this is of standard form.
 * Include a manifest if this is an upgrade.
 *
 * Sequence for running a new app:
 * 1. resolve everything in the config locally, using code in action creator function.
 * 2. bundle up into an action for the shell
 * 2. dispatch action to the shell chain for installation
 * 5. create new root chain to represent the app, using the default name, with status INITIALIZING
 * 3. if waiting for binaries, begin the upload, status: 'UPLOADING'
 * 4. Once ready to install, begin install process for all covenants: INSTALLING
 * 6. After images are ready for execution, create all static chains from the config: DEPLOYING
 * 7. await for input from the users or services to begin normal operation: OPERATING
 *
 * @param {*} config path to a file, object, or JSON describing the application
 */

const api = {
  ping: (to = '.', payload = {}) =>
    Request.create({
      type: 'PING',
      payload: { ...payload, to },
    }),
  login: (terminalChainId, credentials) => ({
    type: 'LOGIN',
    payload: { terminalChainId, credentials },
  }),
  add: (alias, spawnOptions = {}) =>
    Request.create({
      // TODO interpret datums and ask for extra data
      // TODO use path info
      type: 'ADD',
      payload: { alias, spawnOptions },
    }),
  ls: (path = '.') =>
    Request.create({
      type: 'LS',
      payload: { path },
    }),
  rm: (path) => ({
    type: 'RM',
    payload: { path },
  }),
  cd: (path = '.') =>
    Request.create({
      type: 'CD',
      payload: { path },
    }),
  up: (path = '.', remoteParent) => ({
    type: 'UP',
    payload: { path, remoteParent },
  }),
  dispatch: (action, to) => {
    assert.strictEqual(typeof action, 'object')
    assert.strictEqual(typeof to, 'string')
    return Request.create({
      type: 'DISPATCH',
      payload: { action, to },
    })
  },
  /**
   * Many more options are possible, this is just the bare minimum to get operational
   * @param {string} name Hint for consumers
   * @param {object} installer Any required children and their covenants are named here
   * @param {*} path Path to the publication chain.  You must have permission to update this chain.  If the path does not exist but the parent does, a new child will be created
   * @returns
   */
  publish: (name, covenant = {}, parentPath = '.') =>
    Request.create({
      type: 'PUBLISH',
      payload: { name, covenant, parentPath },
    }),
  cat: (path = '.') =>
    Request.create({
      type: 'CAT',
      payload: { path },
    }),
  covenant: (path = '.') =>
    Request.create({ type: 'COVENANT', payload: { path } }),
  //   MV: 'moveActor',
  //   LN: 'linkActor',
  //   LOGOUT: 'logout',
  //   EXEC: 'execute',
  //   BAL: 'balance',
  //   INSTALL: 'install',
  //   DISPATCH: 'dispatch'
  //   EDIT: 'edit' // interprets datum and asks for input data
  //   MERGE: 'merge' // combine one chain into the target chain
  //   CP: 'copy' // fork a chain and give it a new parent
}
// TODO move all api actions to jsonschema
const state = { root: '/', wd: '/' }
export { api, reducer, state }
