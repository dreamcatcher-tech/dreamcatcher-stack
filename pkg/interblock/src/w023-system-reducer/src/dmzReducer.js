import assert from 'assert-fast'
import { openPath, deepestSegment, openChild } from './openPath'
import { pingReducer } from './ping'
import { spawnReducer } from './spawn'
import { installReducer } from './install'
import { genesisReducer } from './genesis'
import { Address, Pulse, PulseLink } from '../../w008-ipld/index.mjs'
import { usePulse } from '../../w010-hooks'
import { autoAlias } from './utils'
import Debug from 'debug'
import posix from 'path-browserify'
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
      const { path } = payload
      let remotePulse = pulse
      if (path !== '.') {
        // TODO make latest handle relative paths
        if (posix.isAbsolute(path)) {
          remotePulse = await latest(path)
        } else {
          remotePulse = await latest(path, pulse)
        }
      }
      const stateModel = remotePulse.getState()
      const state = stateModel.toJS()
      return { state }
    }
    case '@@COVENANT': {
      // TODO remove when can query pulses from reducers
      const path = pulse.getCovenantPath()
      debug(`@@COVENANT`, path)
      const covenant = await latest(path)
      const state = covenant.getState().toJS()
      return { state, path }
    }
    case '@@SET_STATE': {
      const { state } = payload
      assert.strictEqual(typeof state, 'object')
      const nextState = pulse.getState().setMap(state)
      pulse = pulse.setState(nextState)
      setPulse(pulse)
      return
    }
    case '@@USE_PULSE': {
      const { path } = payload
      let remotePulse = pulse
      if (path !== '.') {
        // TODO make latest handle relative paths
        // TODO use the pool pulse as root for walking
        // '..' needs to walk down from appRoot again
        remotePulse = await latest(path)
        // TODO verify that this is consistent with the approot
      }
      assert(remotePulse instanceof Pulse)
      // TODO remove the network object, to provide a static pulse
      return remotePulse
    }
    case '@@DEEPEST_SEGMENT': {
      return deepestSegment(pulse, payload)
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
    case '@@TRY_PATH': {
      const { path } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      debug(`@@TRY_PATH`, path)
      await latest(path)
      return
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
    default:
      throw new Error(`Unrecognized type: ${type}`)
  }
}

export { reducer }
