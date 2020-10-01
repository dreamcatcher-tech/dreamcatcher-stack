const debug = require('debug')('interblock:covenants:shell')
const assert = require('assert')
const dmzReducer = require('../../w021-dmz-reducer')
const { Machine, assign } = require('xstate')
const { spawn, connect } = dmzReducer.actions
const {
  respond,
  send,
  sendParent,
  invoke,
  translator,
} = require('../../w022-xstate-translator')

const config = {
  actions: {
    respondPing: (context, event) => {
      debug(`respondPing event: %O`, event)
      return respond(event.data)
    },
    respondAddActor: (context, event) => respond(event.data.addActor),
  },
  guards: {},
  services: {
    ping: async (context, event) => {
      // if ping '.' respond, else engage in remote pinging
      debug(`ping: %O`, event)
      const { type, payload } = event
      const { to = '.', ...rest } = payload
      assert(type === 'PING')
      if (to === '.') {
        debug(`ping to self`)
        return { type: 'PONG', payload: rest } // TODO move to state machine
      }
      const result = await invoke(type, {}, to)
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
    addActor: async (context, event) => {
      assert.strictEqual(typeof event.payload, 'object')
      const { alias, spawnOptions, to } = event.payload
      debug(`addActor`, alias, to)
      const { type, payload } = spawn(alias, spawnOptions)
      const addActor = await invoke(type, payload, to)

      // calculate path based on working directory

      // TODO if this was remote, open a path to the child ?
      // but don't transmit anything ?
      return { addActor }
    },
    listActors: async (context, event) => {},
    changeDirectory: async (context, event) => {
      const { path } = event.payload
      debug(`changeDirectory`, path)
      assert.strictEqual(typeof path, 'string')

      // walk the path, checking with self if each path exists

      // if path doesn't exist, need to open it

      // if fail to open, reject
    },
    removeActor: async (context, event) => {
      debug(`removeActor`, event)
      // refuse to delete self
      // try open path to child
    },
  },
}
const machine = Machine(
  {
    id: 'shell',
    initial: 'idle',
    context: {
      root: '/',
      wd: '~',
    },
    strict: true,
    states: {
      /**
       * One invocation of this submachine per request that comes in ?
       */
      idle: {
        on: {
          '@@INIT': 'idle',
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
          INSTALL: 'install',
          LOGOUT: 'logout',
          BAL: 'balance',
        },
      },
      ping: {
        invoke: { src: 'ping', onDone: 'idle' },
        exit: 'respondPing',
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
        // TODO handle 'to' field specifying a path
        // makes a new blank child at the given path - may pass covenant and initial state ?
        // if path not exist, error at deepest path
        // can attempt to make all parents too, as part of the options
        // if offline, makes the child locally, then attempts to sync with root

        // respond with the childs alias and address
        // we could wait until it responds with its first live action ?
        // invoke send to self causing DMZ to spawn ?
        invoke: { src: 'addActor', onError: 'idle', onDone: 'idle' },
        exit: 'respondAddActor',
      },
      listActors: {
        // list the current children of the given node

        // resolve the path into absolute path
        // send system action to the absolute path
        // color coded display shows which chains are out of date with root, or if whole system is lagging
        invoke: { src: 'listActors', onDone: 'idle', onError: 'idle' },
      },
      changeDirectory: {
        // change directory to the given path
        // close the current directory
        // telescope down the path and get it to open up to our chainId
        // connect to it and subscribe to future changes
        // probably should subscribe to all parts of the path
        // if error, show the deepest path we got to
        invoke: {
          src: 'changeDirectory',
          onDone: 'idle',
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
      dispatch: {},
      install: {
        // pick default name
        // make a new root chain, using built in covenant type
        // insert the config into it
        // watch it flick its status to 'installing....'
        // when it has everything it needs, it makes all required children
        // pushes the config down in to each direct child, so they unfurl their children
        // opens up the symlinks between all the children
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
 * Executes in client side to prepare the application for interblocking.
 * Checks the config, resolves everything it needs, possibly using a manifest to help.
 * Dispatches into the shell chain once ready.
 * Uploads the binary covenants as needed.
 * Interblock handles install from there on in.
 *
 * Example of a client side augmentation to action creators.
 *
 * @param {*} config path to a file, object, or JSON describing
 * the application
 */
const install = async (config) => {
  const appConfig = jsonAppConfigModel(config)
  const installAction = shell.actions.install(appConfig)
  await dispatch(installAction, '/apps')
}

/**
 * Basic app structure is:
 * /root
 *      .config/  (config is stored in this item ?)
 *          // these items only change on installation events
 *          covenants/
 *              // non system covenants stored here as packages, possibly with source
 *              pingpong
 *                  (with binary)
 *          installs/
 *              // non system covenant installation images
 *              pingpong
 *                  (with binary)
 *      .processes/
 *          // all FSMs and their running threads
 *          // processes change data
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
const jsonAppConfigModel = (config, manifest) => {
  return config
}

const actions = {
  ping: (to = '.', payload) => ({
    type: 'PING',
    payload: { ...payload, to },
  }),
  login: (terminalChainId, credentials) => ({
    type: 'LOGIN',
    payload: { terminalChainId, credentials },
  }),
  add: (alias, spawnOptions = {}, to = '.') => ({
    // TODO interpret datums and ask for extra data
    // TODO use path info
    type: 'ADD',
    payload: { alias, spawnOptions, to },
  }),
  ls: (path) => ({
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
