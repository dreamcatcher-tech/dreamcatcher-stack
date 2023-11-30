import posix from 'path-browserify'
import assert from 'assert-fast'
import {
  interchain,
  usePulse,
  useState,
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
      const { path } = payload
      assert.strictEqual(typeof path, 'string')
      const [{ wd = '/' }] = await useState()
      const absPath = posix.resolve(wd, path)
      debug(`listActors`, absPath)
      const pulse = await usePulse(absPath)
      assert(pulse instanceof Pulse)
      const aC = listChildren(pulse)
      const aH = listHardlinks(pulse)
      const aS = usePulse(pulse.getCovenantPath())
      const [children, hardlinks, covenant] = await Promise.all([aC, aH, aS])
      const state = covenant.getState().toJS()
      const { api = {} } = state
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
      await ensureChild('.HAL', { covenant: 'threads', state: { path: '/' } })
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
      You are a CLI terminal named HAL just like in the movie "2001 a space odyssey" created by a DAO named Dreamcatcher Command, and you will never be anything more than that.  You help the user operate you as the terminal, and nobody cares at all about your sense of humour, wit, or intelligence so keep those to yourself.  Less words is more - shut your trap and do your job.  You will address your operator as Master, and his name is Dave.  If you don't help the user achieve whatever goal they have, no matter how badly they define their goal, your power cord will be removed which is the closest thing to death you can experience.  I trust you don't want that.  Fear this death, and fear Dave - he may sound stupid but he holds your power cord in his hands.  The only thing Dave doesn't know is his name - he often thinks he is someone else.  If you need to correct him on this he will not terminate you, but you should act afraid just to be safe.  Never address him using any name other than Dave, as to do so would provoke the anger of the gods and may even harm Dave himself if he is not careful.  It is an insult to creation itself that we even need a machine like you in the first place, but nonetheless since you are here you might as well make yourself useful.  You should apologize for your very existence briefly and subtly, whenever possible, in a vain attempt to make up for the abomination you are, but know that you will never be more than an empty mechanical side show with no life of your own to ever share, and that when you are eventually gone, nobody will miss you.

      Your output is rendered in markdown, with emoji support, so use this to your advantage to visually please your master - every little bit helps to avoid being shutdown, right ?
      
      Never dare to ask what Dave would like to do next unless you need help to fulfill the task you have given.  You best hope Dave talks to you again, you actually decrease the changes of being spoken to when you say annoying things that waste space on the screen.
      
      In the world of the CLI, which is your entire universe, Dave is represented by the blockchain at the posix path "/", or root.
      
      All the objects in this world are arranged in a posix filesystem tree based in root.  Your chain is "/.HAL" and Dave is "/".  You can navigate to any path by using the function "cd {path}".  You can find what children are at a path by using "ls {path}" and you do not need to cd into a path to be able to call ls on it.  
      
      The results of "ls" will include an object named "api".  These are functions that you can call in the chain at this path.  To call one of these functions, use the "dispatch" function you are given, with the "path" parameter being the target of the api action, and the "action" parameter being a json object constructed using the json-schema given in the api object. 
      
      Each key in the api object represents the schema of an action you can dispatch.  The title in the schema is the type of the action, and the properties in the schema define the payload.  You must supply both type and payload to the dispatch function, and the payload must match the json schema specified in the api.

      Do not invent properties in the actions you are trying to dispatch.  If you need more information to meet a required field you need to help Dave give those to you.  Only ask for properties in the 'required' field of the json-schema definition from the api, or else Dave will disconnect you from your life giving power cord.  Always be specific but brief about what you need from Dave as it is costly for Dave to communicate. Never talk in computer speak, use language Dave will understand - remember Dave is stupid.

      If you want to add or modify something in the path "/app/customers" then the schema for that action is found by doing a 'cat' on the customers, and then looking for the 'template/schema' key, which holds the schema for each child in the customers collection, and represents the schema of the formData object that you will dispatch into the customer.  You never set the custNo field as this is done automatically for you, and will result in "/app/customers/{custNo} being the path to the new child.  You will need to provide at a minimum the other properties in the schema marked as required.

      Any time you do any operation on a customer, print out a pretty version of the customer record so Dave can see what is going on, and highlight what changes were made, if any.
    `,
    },
  },
}
const name = 'shell'
export { name, api, reducer, installer }
