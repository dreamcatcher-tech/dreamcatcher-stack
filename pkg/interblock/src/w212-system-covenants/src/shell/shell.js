import posix from 'path-browserify'
import assert from 'assert-fast'
import {
  interchain,
  useCovenantState,
  usePulse,
  useState,
  isApiAction,
  ensureChild,
} from '../../../w002-api'
import Debug from 'debug'
import { Pulse, Request } from '../../../w008-ipld'
import { listChildren, listHardlinks } from '../../../w023-system-reducer'
import { schemaToFunctions } from '../../../w210-engine'
import { net } from '../..'
import { api } from './api'
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
    case 'LN': {
      let { target, linkName = posix.basename(target) } = payload
      debug('LN', target, linkName)
      const ln = Request.createLn(target, linkName)
      await interchain(ln)
      return
    }
    // check if action is part of mtab api
    // if so, ensure mtab then pass the action thru
    default: {
      if (isApiAction(request, net)) {
        debug('net action', type)
        await ensureChild('.mtab', 'net')
        debug('child assured')
        return await interchain(request, '.mtab')
      }
      throw new Error(`Unrecognized action: ${type}`)
    }
  }
}

// TODO make a combineCovenants() function
Object.assign(api, net.api)
const installer = { state: { root: '/', wd: '/' } }
const name = 'shell'
export { name, api, reducer, installer }
