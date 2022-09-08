import assert from 'assert-fast'
import { openPath, deepestSegment, openChild } from './openPath'
import { pingReducer } from './ping'
import { spawnReducer } from './spawn'
import { installReducer } from './install'
import { getChannelReducer } from './getChannel'
import { genesisReducer } from './genesis'
import { Address, Pulse } from '../../w008-ipld'
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
    case '@@GET_CHAN':
      getChannelReducer(request)
      break
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
    case '@@GET_STATE': {
      const stateModel = pulse.getState()
      const state = stateModel.toJS()
      return { state }
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
      const latestPulse = await latest(path)
      assert(latestPulse instanceof Pulse)
      // TODO remove the network object, to provide a static pulse
      return latestPulse
    }
    case '@@COVENANT': {
      const { path } = payload
      debug(`@@COVENANT`, path)
      const latestByPath = async (path) => {
        if (path !== '.') {
          // TODO apply this optimization at the engine level
          return await latest(path)
          // but need some way to walk blocks relatively ?
        }
        return pulse
      }
      const state = await getCovenantState(path, latestByPath)
      return state
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
      const { path } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      debug(`invalidate`, path)
      let network = pulse.getNetwork()
      let channel = await network.getChannel(path)
      channel = channel.invalidate(path)
      network = await network.updateChannel(channel)
      pulse = pulse.setNetwork(network)
      setPulse(pulse)
      return
    }
    case '@@TRY_PATH': {
      const { path } = payload
      assert.strictEqual(typeof path, 'string')
      assert(path)
      debug(`isValid`, path)
      await latest(path)
      return
    }
    default:
      throw new Error(`Unrecognized type: ${type}`)
  }
}

const getCovenantState = async (path, latestByPath) => {
  assert.strictEqual(typeof path, 'string')
  assert.strictEqual(typeof latestByPath, 'function')
  let latestPulse = await latestByPath(path)
  const { covenant } = latestPulse.provenance.dmz
  assert.strictEqual(typeof covenant, 'string')
  // TODO define covenant resolution algorithm better
  let covenantPath = covenant
  if (!posix.isAbsolute(covenantPath)) {
    // TODO be precise about assumption this is a system covenant
    covenantPath = '/system:/' + covenantPath
  }
  debug('covenantPath', covenantPath)
  const covenantPulse = await latestByPath(covenantPath)
  return covenantPulse.getState().toJS()
}

export { reducer, getCovenantState }
