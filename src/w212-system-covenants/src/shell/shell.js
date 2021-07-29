import Debug from 'debug'
const debug = Debug('interblock:covenants:shell')
const posix = require('path-browserify')
import assert from 'assert'
const { covenantIdModel } = require('../../../w015-models')
const dmzReducer = require('../../../w021-dmz-reducer')
const { Machine, assign } = require('xstate')
const {
  ping,
  spawn,
  connect,
  install,
  getChannel,
  getState: dmzGetState,
} = dmzReducer.actions
const { interchain, useBlocks } = require('../../../w002-api')
const dpkg = require('../dpkg')
const {
  respond,
  send,
  sendParent,
  translator,
} = require('../../../w022-xstate-translator')
const { listChildren } = require('../../../w021-dmz-reducer')
const config = {
  actions: {
    respondOrigin: (context, event) => {
      debug(`respondOrigin`, event.type)
      return respond(event.data)
    },
    assignWd: assign({
      wd: (context, event) => {
        const { absolutePath } = event.data
        assert.strictEqual(typeof absolutePath, 'string')
        const normalized = posix.normalize(absolutePath)
        assert.strictEqual(normalized, absolutePath)
        debug(`assignWd`, absolutePath)
        assert(posix.isAbsolute(absolutePath))
        return absolutePath
      },
    }),
  },
  guards: {},
  services: {
    ping: async (context, event) => {
      // TODO make shell do wd resolution internally
      debug(`ping: %O`, event)
      const { type, payload } = event
      const { to = '.', ...rest } = payload
      assert.strictEqual(type, 'PING')

      const result = await interchain(ping(rest), to)
      debug(`ping result: %O`, result)
      return result
    },
    login: async (context, event) => {
      // TODO make this actually work
      debug(`login: %O`, event.payload)
      const { terminalChainId, credentials } = event.payload
      // TODO check terminal regex is a chainId
      const connectToTerminal = connect('terminal', terminalChainId)
      await interchain(connectToTerminal)

      // TODO import from authenticator / terminal functions
      const loginResult = await interchain('@@INTRO', credentials, 'terminal')
      debug(`loginResult: %O`, loginResult)
      return { loginResult }
    },
    addActor: async ({ wd }, event) => {
      let { alias, spawnOptions } = event.payload
      assert.strictEqual(typeof alias, 'string')
      const absolutePath = posix.resolve(wd, alias)
      const to = posix.dirname(absolutePath)
      let name = posix.basename(absolutePath)
      if (!name && alias) {
        name = alias
        debug(`resetting name to ${name}`)
      }
      debug(`addActor: %O to: %O`, name, to)
      if (typeof spawnOptions === 'string') {
        // TODO unify how covenants are referred to
        const covenantId = covenantIdModel.create(spawnOptions)
        spawnOptions = { covenantId }
      }
      assert.strictEqual(typeof spawnOptions, 'object')
      const spawnAction = spawn(name, spawnOptions)
      const addActor = await interchain(spawnAction, to)
      return addActor
    },
    listActors: async ({ wd }, event) => {
      const { path } = event.payload
      assert.strictEqual(typeof path, 'string')
      const absPath = posix.resolve(wd, path)
      debug(`listActors`, absPath)

      const block = await useBlocks(absPath)
      const children = listChildren(block)
      // TODO implement useCovenant to return an inert json object
      // const covenant = await useCovenant(block)

      return { children }
    },
    changeDirectory: async ({ wd }, event) => {
      // TODO ignore if same as working directory
      let { path } = event.payload
      assert.strictEqual(typeof path, 'string')
      assert(posix.isAbsolute(wd))
      const absolutePath = posix.resolve(wd, path)
      debug(`changeDirectory`, absolutePath)
      try {
        const latest = await useBlocks(absolutePath)
        assert(latest)
        debug(`latest`, absolutePath, latest.getHash().substring(0, 9))
      } catch (e) {
        debug(`changeDirectory error:`, e.message)
        throw new Error(`Non existent blockchain at: ${absolutePath}`)
      }
      return { absolutePath }
    },
    removeActor: async (context, event) => {
      debug(`removeActor`, event)
      // refuse to delete self
      // try open path to child
    },
    dispatch: async (context, event) => {
      const { action, to } = event.payload
      const { type, payload } = action
      debug(`dispatch type: %o to: %o`, type, to)
      const result = await interchain(type, payload, to)
      return result
    },
    publish: async (context, event) => {
      // TODO make covenant resolution use dpkg system
      // TODO support external registries
      // TODO support building images, and displaying progress
      // TODO use npm pack to bundle a package up
      // TODO verify that all covenants are available
      const { name, registry } = event.payload
      let { installer } = event.payload
      if (!Object.keys(installer).length) {
        debug(`making default installer`, name)
        installer = { covenant: name }
      }
      if (!installer.covenant) {
        // TODO formalize how covenants and installers are specified
        installer = { ...installer, covenant: name }
      }
      debug(`publish: `, name)
      const covenantId = covenantIdModel.create('dpkg')
      const state = { installer }
      // TODO add registry in 'to' field, rather than using shell as reg
      await interchain(spawn(name, { covenantId, state }))
      return { dpkgPath: name }
    },
    install: async ({ wd }, event) => {
      const { dpkgPath, installPath } = event.payload
      debug(`install from: %o to: %o`, dpkgPath, installPath)
      const absDpkgPath = posix.resolve(wd, dpkgPath)
      const absInstallPath = posix.resolve(wd, installPath)
      // TODO consider a useState function to only return the state ?
      const { state } = await useBlocks(absDpkgPath)
      const { installer } = state

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
      covenant = covenant || 'unity'
      debug(`installing with covenant: `, covenant)
      const covenantId = covenantIdModel.create(covenant)
      spawnOptions = { ...spawnOptions, covenantId }
      const child = posix.basename(absInstallPath)
      const spawnAction = spawn(child, spawnOptions)
      interchain(spawnAction, absInstallDir)

      debug(`begining install`)
      const installAction = install(installer)
      const installResult = await interchain(installAction, absInstallPath)
      debug(`installResult: `, installResult)
      return installResult
    },
    getState: async ({ wd }, event) => {
      // dump the contents of the chain at the given path
      // if offline, can use the most recent data, but color code that it is stale
      // TODO allow auto updating subscriptions, possibly with broadcast for state
      // TODO may use external functions to fetch blocks, rather than in chainland ?
      const { path } = event.payload
      const absolutePath = posix.resolve(wd, path)
      debug(`getState: `, absolutePath)
      const { state } = await useBlocks(absolutePath)
      debug(`getState result: `, state)
      return { state }
    },
  },
}
const machine = Machine(
  {
    id: 'shell',
    initial: 'idle',
    context: {
      root: '/',
      wd: '/',
    },
    strict: true,
    states: {
      /**
       * One invocation of this submachine per request that comes in ?
       */
      idle: {
        on: {
          PING: 'ping',
          LOGIN: 'login',
          ADD: 'addActor',
          LS: 'listActors',
          CD: 'changeDirectory',
          RM: 'removeActor',
          MV: 'moveActor',
          LN: 'linkActor',
          UP: 'uplinkActor',
          CAT: 'getState',
          DISPATCH: 'dispatch',
          PUBLISH: 'publish',
          INSTALL: 'install',
          LOGOUT: 'logout',
          BAL: 'balance',
        },
      },
      ping: {
        invoke: { src: 'ping', onDone: 'idle' },
        exit: 'respondOrigin',
      },
      login: {
        invoke: { src: 'login', onDone: 'idle' },
        // connect to the address given
        // reject if cannot connect or refused
        // attempt to login
        // reject if login refused
        // if pass, return positive result to requester
      },

      addActor: {
        // if path not exist, error at deepest path
        // can attempt to make all parents too, as part of the options
        // if offline, makes the child locally, then attempts to sync with root

        invoke: { src: 'addActor', onError: 'idle', onDone: 'idle' },
        exit: 'respondOrigin',
      },
      listActors: {
        // color coded display shows which chains are out of date with root, or if whole system is lagging
        invoke: { src: 'listActors', onDone: 'idle', onError: 'idle' },
        exit: 'respondOrigin',
      },
      changeDirectory: {
        // change directory to the given path
        // connect to it and subscribe to future changes
        // probably should subscribe to all parts of the path
        // if error, show the deepest path we got to
        invoke: {
          src: 'changeDirectory',
          onDone: { target: 'idle', actions: ['assignWd', 'respondOrigin'] },
          onError: 'idle',
        },
      },
      removeActor: {
        // deletes the chain at the given path
        invoke: { src: 'removeActor', onDone: 'idle', onError: 'idle' },
      },
      moveActor: {
        // move a chain to a new path, which might be on a different root
        // reject if path does not exist, or not accessible
        // allow --merge to perform a merge on the target of the move
        // specify how to reconcile diffs in the objects
        // includes moving a whole tree too
      },
      linkActor: {
        // set up a softlink to a chain, with optional hardlink as backup parent
        // hardlink with dual parenting ?
      },
      uplinkActor: {
        // move to another parent, but keep a link to the chain here
      },
      getState: {
        invoke: {
          src: 'getState',
          onDone: { target: 'idle', actions: 'respondOrigin' },
        },
      },
      logout: {
        // kill the session chain so needs to be reconnected to AWS
      },
      balance: {
        // remaining balance in Jewels and BAR of this shell, plus any other currencies held
      },
      dispatch: {
        invoke: {
          src: 'dispatch',
          onDone: { target: 'idle', actions: 'respondOrigin' },
        },
      },
      publish: {
        invoke: {
          src: 'publish',
          onDone: { target: 'idle', actions: 'respondOrigin' },
        },
      },
      install: {
        invoke: {
          src: 'install',
          onDone: { target: 'idle', actions: 'respondOrigin' },
        },
      },
      done: {
        id: 'done',
        data: 'info about the files ?',
        type: 'final',
      },
      error: {
        id: 'error',
        type: 'final',
      },
    },
  },
  config
)

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
  add: (alias, spawnOptions = {}) => {
    // TODO unify how covenants are referred to
    return {
      // TODO interpret datums and ask for extra data
      // TODO use path info
      type: 'ADD',
      payload: { alias, spawnOptions },
    }
  },
  ls: (path = '.') => ({
    // can only list children of the current node
    type: 'LS',
    payload: { path },
  }),
  rm: (path) => ({
    type: 'RM',
    payload: { path },
  }),
  cd: (path = '.') => ({
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
const reducer = translator(machine)
module.exports = { actions, reducer }
