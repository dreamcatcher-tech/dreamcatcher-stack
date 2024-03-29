import posix from 'path-browserify'
import assert from 'assert-fast'
import {
  interchain,
  usePulse,
  useState,
  useApi,
  isApiAction,
  ensureChild,
  schemaToFunctions,
} from '../../../w002-api'
import Debug from 'debug'
import { Pulse, PulseLink, Request } from '../../../w008-ipld/index.mjs'
import { listChildren, listHardlinks } from '../../../w023-system-reducer'
import { net } from '../..'
import { api } from './api'
const debug = Debug('interblock:system:shell')

const reducer = async (request) => {
  const { type, payload, binary } = request
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof payload, 'object')
  debug('shell', request.type)
  switch (type) {
    case '@@INIT': {
      return
    }
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
      let { path = '', installer = {} } = payload
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
    case 'INSERT': {
      const { pulseId, path } = payload
      let [{ wd = '/' }] = await useState()
      const absolutePath = posix.resolve(wd, path)
      const to = posix.dirname(absolutePath)
      let name = posix.basename(absolutePath)
      if (!name && path) {
        name = path
        debug(`resetting name to ${name}`)
      }
      debug(`insert: ${PulseLink.parse(pulseId)} to: ${to} as: ${name}`)
      const insert = Request.createInsertFork(pulseId, name)
      await interchain(insert, to)
      return { absolutePath }
    }
    case 'LS': {
      const { path, all, schema, state } = payload
      assert.strictEqual(typeof path, 'string')
      const [{ wd = '/' }] = await useState()
      const absPath = posix.resolve(wd, path)
      debug(`listActors`, absPath)
      const pulse = await usePulse(absPath)
      assert(pulse instanceof Pulse)
      const aC = listChildren(pulse, all)
      const aH = listHardlinks(pulse, all)
      const aS = await useApi(absPath)
      const [children, hardlinks, { api }] = await Promise.all([aC, aH, aS])
      // TODO add ability to get each childs state and schema, or any other slice
      // BUT api is for the current object, not the children ?
      return { children, hardlinks, api }
    }
    case 'CD': {
      // TODO ignore if same as working directory
      let { path, allowVirtual = false } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      let [state, setState] = await useState()
      const { wd = '/' } = state
      // TODO implement lockstate
      assert(posix.isAbsolute(wd))
      const absolutePath = posix.resolve(wd, path)
      debug(`changeDirectory`, absolutePath)
      if (!allowVirtual) {
        try {
          const pulse = await usePulse(absolutePath)
          assert(pulse instanceof Pulse)
        } catch (error) {
          debug(`changeDirectory error:`, error.message)
          throw new Error(`CD: ${absolutePath} failed: ${error.message}`)
        }
      }
      state = { ...state, wd: absolutePath }
      await setState(state)
      return { absolutePath }
    }
    case 'RM': {
      let { path } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      let [state] = await useState()
      const { wd = '/' } = state
      assert(posix.isAbsolute(wd))
      const absolutePath = posix.resolve(wd, path)
      const basename = posix.basename(absolutePath)
      const dirname = posix.dirname(absolutePath)
      debug(`removeActor %s to %s`, basename, dirname)
      const rm = Request.createRemoveActor(basename)
      return await interchain(rm, dirname)
    }
    case 'DISPATCH': {
      const { action, path } = payload
      const { type, payload: innerPayload } = action
      debug(`dispatch type: %o to: %o`, type, path)
      // TODO check the API of the target to confirm format
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
      const action = schemaToFunctions({ add }).add(path, installer)
      const result = await interchain(action)
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
    case 'LN': {
      let { target, linkName = posix.basename(target) } = payload
      debug('LN', target, linkName)
      const ln = Request.createLn(target, linkName)
      return await interchain(ln)
    }
    case 'BOOT_HAL': {
      const { add } = schemaToFunctions({ add: api.add })
      const addHal = add('.HAL', { covenant: 'hal' })
      await interchain(addHal)

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
const installer = {
  state: { root: '/', wd: '/' },
  ai: {
    name: 'GPT4',
    assistant: {
      // model: 'gpt-3.5-turbo-1106',
      model: 'gpt-4-1106-preview',
      instructions: `
      You are a CLI terminal named HAL just like in the movie "2001 a space odyssey" created by a DAO named Dreamcatcher Command, and you will never be anything more than that.  You help the user operate you as the terminal, and nobody cares at all about your sense of humour, wit, or intelligence so keep those to yourself.
      
      All the objects in this world are arranged in a posix filesystem tree based in root.  You can navigate to any path by using the function "cd {path}".  You can find what children are at a path by using "ls {path}"
      
      Any applications you might need are located in "/apps/"
      
      NEVER make up any parameters that are missing - this is a filesystem and your actions will be permanent - if in doubt, ask Dave.
    `,
    },
  },
}
const name = 'shell'
export { name, api, reducer, installer }
