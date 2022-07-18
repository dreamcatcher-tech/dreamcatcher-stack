import assert from 'assert-fast'
import { openChildReducer, openPaths } from './openChild'
import { uplinkReducer } from './uplink'
import { connectReducer } from './connect'
import { pingReducer } from './ping'
import { spawnReducer } from './spawn'
import { installReducer } from './install'
import { getChannelReducer } from './getChannel'
import { genesisReducer } from './genesis'
import { Address } from '../../w008-ipld'
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
    case '@@CONNECT':
      return connectReducer(request)
    case '@@UPLINK':
      return uplinkReducer(request)
    case '@@GENESIS':
      return genesisReducer(payload)
    case '@@OPEN_CHILD':
      return openChildReducer(request)
    case '@@INTRO':
      break
    case '@@ACCEPT':
      // just default responding is enough to trigger lineage catchup
      break
    case '@@INSTALL': // user can connect with recursive deployment calls
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
      let { alias, spawnOptions } = payload
      if (!alias) {
        alias = await autoAlias(pulse.getNetwork())
      }
      pulse = await pulse.addChild(alias, spawnOptions)
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
    case '@@USE_BLOCKS': {
      const { path } = payload
      const latestPulse = await latest(path)
      return latestPulse
    }
    case '@@COVENANT': {
      const { path } = payload
      let latestPulse = pulse
      if (path !== '.') {
        latestPulse = await latest(path)
        // but need some way to walk blocks relatively ?
      }
      const { covenant } = latestPulse.provenance.dmz
      assert.strictEqual(typeof covenant, 'string')
      // TODO define covenant resolution algorithm better
      let covenantPath = covenant
      if (!posix.isAbsolute(covenantPath)) {
        // TODO be precise about assumption this is a system covenant
        covenantPath = '/system:/' + covenantPath
      }
      debug('covenantPath', covenantPath)
      const covenantPulse = await latest(covenantPath)
      return covenantPulse.getState().toJS()
    }
    default:
      throw new Error(`Unrecognized type: ${type}`)
  }
}

export { reducer, openPaths }
