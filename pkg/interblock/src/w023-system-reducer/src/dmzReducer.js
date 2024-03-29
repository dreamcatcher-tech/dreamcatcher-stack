import assert from 'assert-fast'
import { validate } from '../../w002-api'
import { openPath, openChild } from './openPath'
import { pingReducer } from './ping'
import { spawnReducer } from './spawn'
import { installReducer } from './install'
import { genesisReducer } from './genesis'
import { Network, Address, Pulse, PulseLink } from '../../w008-ipld/index.mjs'
import { usePulse } from '../../w010-hooks'
import { autoAlias } from './utils'
import Debug from 'debug'
import posix from 'path-browserify'
import merge from 'lodash.merge'
const debug = Debug('interblock:dmz')

/**
 * DmzReducer is responsible for:
 *  1. altering the structure of the DMZ
 *  2. checking the ACL for all actions coming in
 *
 * It is modelled the same as a covenant reducer so that:
 *  1. the interpreter logic is the same for covenants and system
 *  2. users interact with the dmz logic the same was as with other chains
 *  3. foreign chains can control the dmz logic easily
 *
 * @param {*} dmz
 * @param {Object} request
 */

const reducer = (request) => {
  debug(`reducer( ${request.type} )`)
  const { type, payload } = request
  /**
   * All these functions use interchain communications in some way,
   * and they do not make modifications to the Pulse at all.
   */
  switch (type) {
    case '@@PING':
      return pingReducer(request)
    case '@@SPAWN':
      return spawnReducer(payload)
    case '@@GENESIS':
      return genesisReducer(payload)
    case '@@OPEN_PATH':
      return openPath(payload)
    case '@@OPEN_CHILD':
      return openChild(payload)
    case '@@INTRO':
      break
    case '@@ACCEPT':
      // just default responding is enough to trigger lineage catchup
      break
    case '@@INSTALL':
      return installReducer(payload)
    default:
      return pulseReducer(type, payload)
  }
}
/**
 * pulseReducer makes use of the usePulse() hook.
 * It always returns directly, without making any interchain calls.
 * Pulse cannot be stored between repeat runs, hence why interchain calls
 * are prohibited any time usePulse() is called.
 * @param {string} type
 * @param {object} payload
 * @returns
 */
const pulseReducer = async (type, payload) => {
  // TODO this is the soft pulse, we need a way to get baked unaltered pulses
  // and store them in pending by their hash alone
  let [pulse, setPulse, latest] = usePulse()
  switch (type) {
    case '@@ADD_CHILD': {
      let { alias, installer } = payload
      if (!alias) {
        alias = await autoAlias(pulse.getNetwork())
      }
      pulse = await pulse.addChild(alias, installer)
      setPulse(pulse)
      const { entropy } = pulse.provenance.dmz.config
      const { address } = await pulse.getNetwork().getChild(alias)
      assert(address instanceof Address)
      assert(address.isRemote())
      const chainId = address.getChainId()
      return { alias, chainId, entropy }
    }
    case '@@INSERT_FORK': {
      let { pulseId, name } = payload
      debug(`@@INSERT_FORK`, pulseId, name)
      const forkLatest = PulseLink.parse(pulseId)
      const fork = await latest(forkLatest)
      if (!name) {
        name = await autoAlias(pulse.getNetwork())
      }
      pulse = await pulse.insertFork(name, fork)
      setPulse(pulse)
      return
    }
    case '@@GET_STATE': {
      const remotePulse = await getRemotePulse(payload, pulse, latest)
      const stateModel = remotePulse.getState()
      const state = stateModel.toJS()
      return { state }
    }
    case '@@SET_STATE': {
      const { changes, replace } = payload
      assert.strictEqual(typeof changes, 'object')
      const state = pulse.getState().toJS()
      const merged = replace ? changes : merge({}, state, changes)

      const schema = pulse.getSchema()
      validate('setState', schema, merged)

      const nextState = pulse.getState().setMap(merged)
      pulse = pulse.setState(nextState)
      setPulse(pulse)
      return merged
    }
    case '@@GET_SCHEMA': {
      const remotePulse = await getRemotePulse(payload, pulse, latest)
      const schema = remotePulse.getSchema()
      return { schema }
    }
    case '@@SET_SCHEMA': {
      const { schema } = payload
      assert.strictEqual(typeof schema, 'object')
      pulse = pulse.setSchema(schema)
      setPulse(pulse)
      return
    }
    case '@@GET_AI': {
      const remotePulse = await getRemotePulse(payload, pulse, latest)
      const ai = remotePulse.getAI()
      // need a default of some kind
      if (ai) {
        return { ai }
      }
      return
    }
    case '@@SET_AI': {
      // TODO check format against ai schema and action schema
      const { ai } = payload
      pulse = pulse.setAI(ai)
      setPulse(pulse)
      return
    }
    case '@@COVENANT': {
      // TODO remove when can query pulses from reducers
      const path = pulse.getCovenantPath()
      debug(`@@COVENANT`, path)
      const covenant = await latest(path, pulse)
      const state = covenant.getState().toJS()
      return { state, path }
    }
    case '@@API': {
      const remotePulse = await getRemotePulse(payload, pulse, latest)
      const covenantPath = remotePulse.getCovenantPath()
      const covenant = await latest(covenantPath)
      const { api } = covenant.getState().toJS()
      return api
    }
    case '@@USE_PULSE': {
      return getRemotePulse(payload, pulse, latest)
    }
    case '@@CONNECT': {
      const { chainId } = payload
      const address = Address.fromChainId(chainId)
      let network = pulse.getNetwork()
      network = await network.addUplink(address)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      const childChainId = pulse.getAddress().getChainId()
      return { childChainId }
    }
    case '@@SELF_ID': {
      const chainId = pulse.getAddress().getChainId()
      return { chainId }
    }
    case '@@RESOLVE_DOWNLINK': {
      const { path, chainId } = payload
      const address = Address.fromChainId(chainId)
      assert(address.isRemote())
      let network = pulse.getNetwork()
      // BUT what if it is an alias, but now we have data on the channel ?
      // could we copy over the data, and it would still work ?
      // only if it didn't have ids yet would this work

      network = await network.resolveDownlink(path, address)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      return
    }
    case '@@INVALIDATE': {
      const { path, errorSerialized } = payload
      // this is a strictly internal error
      assert.strictEqual(typeof path, 'string')
      assert(path)
      debug(`invalidate`, path)
      let network = pulse.getNetwork()
      let channel = await network.getChannel(path)
      channel = channel.invalidate(path, errorSerialized)
      network = await network.updateChannel(channel)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      return
    }
    case '@@GET_ADDRESS': {
      const { path } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      debug(`@@GET_ADDRESS`, path)
      const pulse = await latest(path)
      const chainId = pulse.getAddress().getChainId()
      return { chainId }
    }
    case '@@LN': {
      const { target, linkName } = payload
      debug('@@LN', payload)
      const network = await pulse.getNetwork().setSymlink(linkName, target)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      return
    }
    case '@@HARDLINK': {
      const { name, chainId } = payload
      let network = pulse.getNetwork()
      if (await network.hasChannel(name)) {
        throw new Error(`remote name already used: ${name}`)
      }
      const address = Address.fromChainId(chainId)
      network = await network.setHardlink(name, address)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      return
    }
    case '@@RM': {
      const { path } = payload
      const network = await pulse.getNetwork().rm(path)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      return
    }
    case '@@CONFIG': {
      pulse = pulse.setMap({ provenance: { dmz: { config: payload } } })
      setPulse(pulse)
      return
    }
    case '@@LS': {
      // TODO make this a stream somehow ?
      const remotePulse = await getRemotePulse(payload, pulse, latest)
      const children = []
      const childrenHamt = remotePulse.getNetwork().children
      for await (const [alias, channelId] of childrenHamt.entries()) {
        // TODO skip anything that is a genesis request
        if (Network.isSpecialChannel(channelId)) {
          continue
        }
        children.push(alias)
      }
      return { children }
    }
    default:
      throw new Error(`Unrecognized type: ${type}`)
  }
}

const getRemotePulse = async (payload, pulse, latest) => {
  const { path } = payload
  assert(pulse instanceof Pulse)
  assert(latest instanceof Function)

  let remotePulse = pulse
  if (path !== '.') {
    // TODO use the pool pulse as root for walking
    if (!posix.isAbsolute(path)) {
      remotePulse = await latest(path, pulse)
    } else {
      remotePulse = await latest(path)
    }
    // TODO verify that this is consistent with the approot
  }
  assert(remotePulse instanceof Pulse)
  // TODO remove the network object, to provide a static pulse
  return remotePulse
}

export { reducer }
