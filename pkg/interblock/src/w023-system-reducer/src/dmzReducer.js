import assert from 'assert-fast'
import { openChildReducer, openPaths } from './openChild'
import { uplinkReducer } from './uplink'
import { connect, connectReducer } from './connect'
import { pingReducer } from './ping'
import { spawnReducer } from './spawn'
import { install, deploy, deployReducer } from './deploy'
import { getChannel, getChannelReducer } from './getChannel'
import { genesisReducer } from './genesis'
import { Address } from '../../w008-ipld'
import { usePulse } from '../../w010-hooks'
import { autoAlias } from './utils'
import Debug from 'debug'
const debug = Debug('interblock:dmz')
const actions = {
  connect,
  install,
  deploy,
  getChannel,
}
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
    case '@@DEPLOY':
      return deployReducer(request)
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
      const nextState = pulse.getState().update(state)
      pulse = pulse.setState(nextState)
      setPulse(pulse)
      return
    }
    case '@@USE_BLOCKS': {
      const { path } = payload
      const latestPulse = await latest(path)
      return latestPulse
    }
    default:
      throw new Error(`Unrecognized type: ${type}`)
  }
}

export { actions, reducer, openPaths }
