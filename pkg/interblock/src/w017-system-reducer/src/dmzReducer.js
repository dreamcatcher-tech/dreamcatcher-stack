import assert from 'assert-fast'
import { openChildReducer, openChildReply, openPaths } from './openChild'
import { uplinkReducer, uplinkReply } from './uplink'
import { connect, connectReducer } from './connect'
import { ping, pingReducer } from './ping'
import { spawn, spawnReducer } from './spawn'
import {
  install,
  deploy,
  deployReducer,
  deployReply,
  deployGenesisReply,
} from './deploy'
import { getChannel, getChannelReducer } from './getChannel'
import { genesisReducer, genesisReply, initReply } from './genesis'
import { getStateReducer, getState } from './getState'
import { Dmz, RxRequest, RxReply, Provenance } from '../../w008-ipld'
import Debug from 'debug'
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
 * These are all the commands that are possible to invoke remotely.
 * Whilst transmissions could be entered directly into the dmz in this
 * reducer, using the api methods for sending allows greater debug ability.
 *
 * @param {*} dmz
 * @param {*} action
 */

const actions = {
  connect,
  ping,
  spawn,
  install,
  deploy,
  getChannel,
  getState,
}

const reducer = (provenance, action) => {
  // TODO check the ACL each time ?
  debug(`reducer( ${action.type} )`)
  // TODO remove provenance, and make it fetched by useBlock
  assert(provenance instanceof Provenance)
  assert(action instanceof RxRequest)
  let { dmz } = provenance

  switch (action.type) {
    case '@@PING':
      pingReducer(action)
      break
    case '@@SPAWN':
      return spawnReducer(provenance, action)
    case '@@CONNECT':
      return connectReducer(dmz, action)
    case '@@UPLINK':
      return uplinkReducer(dmz, action)
    case '@@GENESIS':
      return genesisReducer(dmz, action)
    case '@@OPEN_CHILD':
      return openChildReducer(dmz, action)
    case '@@INTRO':
      break
    case '@@ACCEPT':
      // just default responding is enough to trigger lineage catchup
      break
    case '@@INSTALL': // user can connect with recursive deployment calls
    case '@@DEPLOY':
      return deployReducer(dmz, action)
    case '@@GET_CHAN':
      getChannelReducer(dmz.network, action)
      break
    case '@@CAT':
      getStateReducer(dmz)
      break
    default:
      throw new Error(`Unrecognized type: ${action.type}`)
  }

  return dmz
}

const rm = (id) => {
  // id either alias or address
  // if we are parent, kill the tree
}
const mv = () => {
  // tricky, as needs to handover with ability to rollback
}

const systemTypes = [
  '@@PING',
  '@@SPAWN',
  '@@GENESIS',
  '@@CONNECT',
  '@@UPLINK',
  '@@INTRO',
  '@@ACCEPT',
  '@@OPEN_CHILD',
  '@@GET_GIVEN_NAME', // TODO may delete ?
  '@@DEPLOY',
  '@@INSTALL',
  '@@GET_CHAN', // TODO may delete ?
  '@@CAT',
]

const isSystemReply = (dmz, action) => {
  assert(dmz instanceof Dmz)
  if (!(action instanceof RxReply)) {
    assert(action instanceof RxRequest)
    return false
  }
  const isSystemReply = dmz.meta.isAwaiting(action)
  debug(`isSystemReply: ${isSystemReply} type: ${action.type}`)
  return isSystemReply
}

const isSystemRequest = (request) => {
  if (!(request instanceof RxRequest)) {
    return false
  }
  const isSystemAction = systemTypes.includes(request.type)
  debug(`isSystemAction: ${isSystemAction} type: ${request.type}`)
  return isSystemAction
}

export { actions, reducer, isSystemRequest, isSystemReply, openPaths }
