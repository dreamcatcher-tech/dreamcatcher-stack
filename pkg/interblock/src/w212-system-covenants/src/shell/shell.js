import { multiaddr as fromString } from '@multiformats/multiaddr'
import { peerIdFromString } from '@libp2p/peer-id'
import posix from 'path-browserify'
import assert from 'assert-fast'
import {
  interchain,
  useCovenantState,
  usePulse,
  useState,
} from '../../../w002-api'
import Debug from 'debug'
import { Address, Pulse, Request } from '../../../w008-ipld'
import { listChildren, listHardlinks } from '../../../w023-system-reducer'
import { schemaToFunctions } from '../../../w210-engine'
const debug = Debug('interblock:system:shell')

const reducer = async (request) => {
  const { type, payload, binary } = request
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof payload, 'object')
  debug('shell', request.type)
  switch (type) {
    case 'PING': {
      debug(`ping: %O`, payload)
      let { to, message } = payload
      const [{ wd = '/' }] = await useState()
      if (!to) {
        to = wd
      }
      const absolutePath = posix.resolve(wd, to)

      const ping = Request.createPing(message)
      const result = await interchain(ping, absolutePath)
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
      debug(`login: %O`, payload)
      const { terminalChainId, credentials } = payload
      // TODO check terminal regex is a chainId
      await interchain('@@CONNECT', { terminalChainId })

      // TODO import from authenticator / terminal functions
      const loginResult = await interchain('@@INTRO', credentials, 'terminal')
      debug(`loginResult: %O`, loginResult)
      return { loginResult }
    }
    case 'ADD': {
      let { path, installer = {} } = payload
      assert.strictEqual(typeof path, 'string')
      debug('installer', installer)
      if (typeof installer === 'string') {
        installer = { covenant: installer }
      }
      assert.strictEqual(typeof installer, 'object')
      const [{ wd = '/' }] = await useState()
      debug('wd', wd)
      const absolutePath = posix.resolve(wd, path)
      const to = posix.dirname(absolutePath)
      let basename = posix.basename(absolutePath)
      if (!basename && path) {
        basename = path
        debug(`resetting name to ${basename}`)
      }
      debug(`addActor: %O to: %O`, basename, to)
      assert.strictEqual(typeof installer, 'object')

      const spawnAction = Request.createSpawn(basename, installer)
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
      const pulse = await usePulse(absPath)
      assert(pulse instanceof Pulse)
      const aC = listChildren(pulse)
      const aH = listHardlinks(pulse)
      const aS = useCovenantState(absPath)
      const [children, hardlinks, state] = await Promise.all([aC, aH, aS])
      const { api = {} } = state
      return { children, hardlinks, api }
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
        const pulse = await usePulse(absolutePath)
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
      const { action, path } = payload
      const { type, payload: innerPayload } = action
      debug(`dispatch type: %o to: %o`, type, path)
      const result = await interchain(type, innerPayload, path)
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
      const installer = { covenant: 'covenant', state: covenant }
      const { add } = api
      const apiFn = schemaToFunctions({ add })
      const result = await interchain(apiFn.add(path, installer))
      debug(result)
      return { path }
    }
    case 'CAT': {
      // TODO add flags to get the full pulse, or portions of the state
      const { path } = payload
      let [{ wd = '/' }] = await useState()
      const absolutePath = posix.resolve(wd, path)
      debug(`getState: `, absolutePath)
      const pulse = await usePulse(absolutePath)
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
    case 'NET_CONNECT': {
      // provide with a multiaddr then insert this into libp2p
      return
    }
    case 'NET_MAP': {
      // map a nodeId to an address
      return
    }
    case 'LN': {
      let { target, linkName = posix.basename(target) } = payload
      debug('LN', target, linkName)
      const ln = Request.createLn(target, linkName)
      await interchain(ln)
      return
    }
    case 'MOUNT': {
      const { chainId, name } = payload
      debug('mount', name, chainId.substr(0, 14))
      const mount = Request.createMount(chainId, name)
      return await interchain(mount)
    }
    case 'PEER': {
      const { peerId: peerIdString, chainId } = payload
      const peerId = peerIdFromString(peerIdString)
      const address = Address.fromChainId(chainId)
      return
    }
    case 'MULTIADDR': {
      const { multiaddr } = payload
      const addr = fromString(multiaddr)
      // ensure mtab chain
      return
    }
    // check if action is part of mtab api
    // if so, ensure mtab then pass the action thru
    default: {
      throw new Error(`Unrecognized action: ${type}`)
    }
  }
}

const api = {
  ping: {
    type: 'object',
    title: 'PING',
    description: 'Ping a remote chain',
    additionalProperties: true,
    required: [],
    properties: {
      to: { type: 'string' },
      message: { type: 'object' },
    },
  },
  login: {
    type: 'object',
    title: 'LOGIN',
    description: `Authenticate with a remote app complex
Loop the user through a signon process that links
The current machine pubkey to their interblock user chain.
When this occurs, the guest chain will transition to the
user chain, and the prompt will change from "guest" to "user"
    `,
    additionalProperties: false,
    required: ['chainId', 'credentials'],
    properties: {
      chainId: { type: 'string' }, // TODO regex
      credentials: { type: 'object' },
    },
  },
  add: {
    type: 'object',
    title: 'ADD',
    description: `Add a new chain at the optional path, with optional given installer.  If no path is given, a reasonable default will be chosen`,
    additionalProperties: false,
    required: [],
    properties: {
      // TODO interpret datums and ask for extra data
      path: { type: 'string' }, // TODO regex
      installer: {
        oneOf: [{ type: 'string' }, { type: 'object', default: {} }],
      }, // TODO use pulse to validate format
    },
  },
  ls: {
    type: 'object',
    title: 'LS',
    description: `List all children, and any actions available in the chain at the given path`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
    },
  },
  rm: {
    type: 'object',
    title: 'RM',
    description: `Attempt to remove the chain at the given path, and all its children`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
      history: {
        type: 'boolean',
        default: false,
        description: `Remove the history too`,
      },
    },
  },
  cd: {
    type: 'object',
    title: 'CD',
    description: `Change directory to the given path`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
    },
  },
  dispatch: {
    type: 'object',
    title: 'DISPATCH',
    description: `Dispatch an action to a remote chain`,
    additionalProperties: false,
    required: ['action', 'path'],
    properties: {
      action: { type: 'object' },
      path: { type: 'string', default: '.' }, // TODO regex
    },
  },
  publish: {
    type: 'object',
    title: 'PUBLISH',
    description: `Make a covenant ready for consumption`,
    additionalProperties: false,
    required: ['name', 'covenant', 'parentPath'],
    properties: {
      name: { type: 'string', description: `A friendly hint for consumers` }, // TODO regex to ensure no path
      covenant: {
        type: 'object',
        description: `The state of the pulished covenant chain`,
        // TODO use covenant state regex
      },
      parentPath: {
        type: 'string',
        default: '.',
        description: `Path to the publication chain.  You must have permission to update this chain.  If the path does not exist but the parent does, a new default child will be created`,
      }, // TODO regex
    },
  },
  cat: {
    type: 'object',
    title: 'CAT',
    description: `Return the state as an object at the given path`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
    },
  },
  covenant: {
    type: 'object',
    title: 'COVENANT',
    description: `Return the state of a published covenant`,
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', default: '.' }, // TODO regex
    },
  },
  mount: {
    type: 'object',
    title: 'MOUNT',
    description: `Attempt to mount the given chainId at the given mountPath.
      This will make an entry in mtab if there is not one already.`,
    additionalProperties: false,
    required: ['chainId', 'name'],
    properties: {
      chainId: { type: 'string', pattern: 'Qm[1-9A-Za-z]{44}' },
      name: { type: 'string' }, // TODO regex to have no path elements
    },
  },
  ln: {
    type: 'object',
    title: 'LN',
    description: `Link to target path.
Linking is act of inserting one Object as the child of another
which allows an Object to be the child of more than one parent.
This operation is essential to application data structures
as opposed to simple filesystem data structures, which are 
usually a tree`,
    required: ['target'],
    properties: {
      target: { type: 'string' },
      linkName: {
        type: 'string',
        description: `defaults to the target name.  Must not have any pathing`,
      },
    },
  },
  multiaddr: {
    type: 'object',
    title: 'MULTIADDR',
    description: `Add a new multiaddr to network memory`,
    required: ['multiaddr'],
    properties: {
      // TODO regex that requires pubkey and valid multiaddr
      multiaddr: { type: 'string' },
    },
  },
  peer: {
    type: 'object',
    title: 'PEER',
    description: `Add a new multiaddr to network memory`,
    required: ['peerId', 'chainId'],
    properties: {
      // TODO regex
      peerId: { type: 'string' },
      chainId: { type: 'string' },
    },
  },
  validators: {
    type: 'object',
    title: 'VALIDATORS',
    description: `
    View, change the validator set of a chain or group of chains.
    Recursively change all validators of the chains children.
    Validators must accept the role before the handover is complete.
    Can be used to force a change if a chain has stalled.
    `,
    // TODO make this a subset of all ACL type of operations
  },
  //   MV: 'moveActor',
  //   LOGOUT: 'logout',
  //   EXEC: 'execute',
  //   BAL: 'balance',
  //   EDIT: 'edit' // interprets datum and asks for input data
  //   MERGE: 'merge' // combine one chain into the target chain
  //   CP: 'copy' // fork a chain and give it a new parent
}
const installer = { state: { root: '/', wd: '/' } }
const name = 'shell'
export { name, api, reducer, installer }
