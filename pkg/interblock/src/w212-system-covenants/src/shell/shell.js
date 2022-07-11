import posix from 'path-browserify'
import assert from 'assert-fast'
import { interchain, useBlocks, useState } from '../../../w002-api'
import Debug from 'debug'
import { Pulse, Request } from '../../../w008-ipld'
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
      const { path } = event.payload
      assert.strictEqual(typeof path, 'string')
      const absPath = posix.resolve(wd, path)
      debug(`listActors`, absPath)

      const block = await useBlocks(absPath)
      const children = listChildren(block)
      // TODO implement useCovenant to return an inert json object
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
        const { pulse } = await useBlocks(absolutePath)
        assert(pulse instanceof Pulse)
        debug(`latest`, absolutePath, pulse.getPulseLink())
        state = { ...state, wd: absolutePath }
        await setState(state)
      } catch (e) {
        debug(`changeDirectory error:`, e.message)
        throw new Error(`Non existent pulsechain at: ${absolutePath}`)
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
      const { action, to } = event.payload
      const { type, payload } = action
      debug(`dispatch type: %o to: %o`, type, to)
      const result = await interchain(type, payload, to)
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
      // TODO make covenant resolution use dpkg system
      // TODO support external registries
      // TODO support building images, and displaying progress
      // TODO use npm pack to bundle a package up
      // TODO verify that all covenants are available
      const { name, registry } = event.payload
      let { installer } = event.payload
      if (!Object.keys(installer).length) {
        debug(`making default installer`, name)
        installer = { covenant: 'app' }
      }
      if (!installer.covenant) {
        // TODO formalize how covenants and installers are specified
        installer = { ...installer, covenant: 'app' }
      }
      debug(`publish: `, name)
      const covenantId = CovenantId.create('dpkg')
      const state = { installer }
      // TODO add registry in 'to' field, rather than using shell as reg
      await interchain(spawn(name, { covenantId, state }))
      return { dpkgPath: name }
    }
    case 'INSTALL': {
      const { dpkgPath, installPath } = event.payload
      debug(`install from: %o to: %o`, dpkgPath, installPath)
      const absDpkgPath = posix.resolve(wd, dpkgPath)
      const absInstallPath = posix.resolve(wd, installPath)
      // TODO consider a useState function to only return the state ?
      const latest = await useBlocks(absDpkgPath)
      const { installer } = latest.getState()

      const absInstallDir = posix.dirname(absInstallPath)
      try {
        await useBlocks(absInstallDir) // check path exists
      } catch (e) {
        throw new Error(`Install directory invalid for: ${absInstallPath}`)
      }

      // TODO check schema matches installer schema, including not null for covenant
      // TODO pull out everything that is part of DMZ except children
      // TODO ? make a dedicated app root for each app, so we can control cleanup ?
      // TODO verify that all covenants in installer are available
      let { children, covenant, ...spawnOptions } = installer
      // TODO unify how covenants are referred to
      covenant = 'app'
      debug(`installing with covenant: `, covenant)
      const covenantId = CovenantId.create(covenant)
      spawnOptions = { ...spawnOptions, covenantId }
      const child = posix.basename(absInstallPath)
      const spawnAction = spawn(child, spawnOptions)
      interchain(spawnAction, absInstallDir)

      debug(`beginning install`)
      const installAction = install(installer)
      const installResult = await interchain(installAction, absInstallPath)
      debug(`installResult: `, installResult)
      return installResult
    }
    case 'CAT': {
      // dump the contents of the chain at the given path
      // if offline, can use the most recent data, but color code that it is stale
      // TODO allow auto updating subscriptions, possibly with broadcast for state
      // TODO may use external functions to fetch blocks, rather than in chainland ?
      const { path } = event.payload
      const absolutePath = posix.resolve(wd, path)
      debug(`getState: `, absolutePath)
      const { state } = await useBlocks(absolutePath)
      debug(`getState result: `, state)
      return { state: state.toJS() }
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

const actions = {
  ping: (to = '.', payload = {}) => ({
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
  ls: (path = '.') => ({
    // can only list children of the current node
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
    return {
      type: 'DISPATCH',
      payload: { action, to },
    }
  },
  install: (dpkgPath, installPath) => ({
    type: 'INSTALL',
    payload: { dpkgPath, installPath },
  }),
  publish: (name, installer = {}, covenantId = {}, registry = '.') => ({
    // TODO handle nested covenants ?
    // TODO move to using a hardware path for covenant
    // TODO remove install file, instead generate from loading covenant in isolation
    type: 'PUBLISH',
    payload: { name, installer, covenantId, registry },
  }),
  cat: (path = '.') => ({
    type: 'CAT',
    payload: { path },
  }),
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
const state = { root: '/', wd: '/' }
export { actions, reducer, state }
