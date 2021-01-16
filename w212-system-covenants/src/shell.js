const debug = require('debug')('interblock:covenants:shell')
const posix = require('path')
const assert = require('assert')
const { covenantIdModel } = require('../../w015-models')
const dmzReducer = require('../../w021-dmz-reducer')
const { Machine, assign } = require('xstate')
const {
  ping,
  spawn,
  connect,
  listChildren,
  install,
  getChannel,
} = dmzReducer.actions
const { interchain } = require('../../w002-api')
const dpkg = require('./dpkg')
const {
  respond,
  send,
  sendParent,
  translator,
} = require('../../w022-xstate-translator')

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
        return absolutePath
      },
    }),
  },
  guards: {},
  services: {
    ping: async (context, event) => {
      debug(`ping: %O`, event)
      const { type, payload } = event
      const { to = '.', ...rest } = payload
      assert.strictEqual(type, 'PING')

      const result = await interchain(ping(rest), to)
      debug(`ping result: %O`, result)
      return result
    },
    login: async (context, event) => {
      debug(`login: %O`, event.payload)
      const { terminalChainId, credentials } = event.payload
      // TODO check terminal regex is a chainId
      const connectToTerminal = connect('terminal', terminalChainId)
      await invoke(connectToTerminal)

      // TODO import from authenticator / terminal functions
      const loginResult = await invoke('@@INTRO', credentials, 'terminal')
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
      const absolutePath = posix.resolve(wd, path)
      debug(`listActors`, absolutePath)
      const lsAction = listChildren(path)
      const { children } = await interchain(lsAction, absolutePath)
      const self = await interchain(getChannel(absolutePath))
      return { children: { ...children, '.': self } }
    },
    changeDirectory: async ({ wd }, event) => {
      let { path } = event.payload
      assert.strictEqual(typeof path, 'string')
      assert(posix.isAbsolute(wd))
      const absolutePath = posix.resolve(wd, path)
      debug(`changeDirectory`, absolutePath)
      await interchain(ping(), absolutePath)
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
      const { name, installer, registry } = event.payload
      debug(`publish: `, name)
      const covenantId = covenantIdModel.create('dpkg')
      const state = { installer }
      await interchain(spawn(name, { covenantId, state }))
      return { dpkgPath: name }
    },
    install: async (context, event) => {
      const { dpkgPath, installPath } = event.payload
      const installer = await interchain(dpkg.actions.getInstaller(), dpkgPath)
      // TODO check installPath exists and is legal, and is direct child of something
      // TODO check schema matches installer schema, including not null for covenant
      // TODO pull out everything that is part of DMZ except children
      let { children, covenant, ...spawnOptions } = installer
      covenant = covenant || 'unity'
      // TODO unify how covenants are referred to
      const covenantId = covenantIdModel.create(covenant)
      spawnOptions = { ...spawnOptions, covenantId }
      const spawnAction = spawn(installPath, spawnOptions)
      interchain(spawnAction)

      debug(`begining install`)
      const installAction = install(installer)
      const installResult = await interchain(installAction, installPath)
      debug(`installResult: `, installResult)
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
      },
      linkActor: {
        // set up a softlink to a chain, with optional hardlink as backup parent
        // hardlink with dual parenting ?
      },
      uplinkActor: {
        // move to another parent, but keep a link to the chain here
      },
      getState: {
        // dump the contents of the chain at the given path
        // if offline, can use the most recent data, but color code that it is stale
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
  publish: (name, installer = {}, registry = '.') => ({
    // TODO move to using a hardware path for covenant
    // TODO remove install file, instead generate from loading covenant in isolation
    type: 'PUBLISH',
    payload: { name, installer, registry },
  }),
  //   MV: 'moveActor',
  //   LN: 'linkActor',
  //   CAT: 'getState',
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
