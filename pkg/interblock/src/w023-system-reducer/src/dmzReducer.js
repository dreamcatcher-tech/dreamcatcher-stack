import assert from 'assert-fast'
import { openChildReducer, openChildReply, openPaths } from './openChild'
import { uplinkReducer, uplinkReply } from './uplink'
import { connect, connectReducer } from './connect'
import { ping, pingReducer } from './ping'
import { spawn, spawnReducer } from './spawn'
import { install, deploy, deployReducer } from './deploy'
import { getChannel, getChannelReducer } from './getChannel'
import { genesisReducer } from './genesis'
import { Address } from '../../w008-ipld'
import { usePulse } from '../../w010-hooks'
import { autoAlias } from './utils'
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
}

const reducer = (request) => {
  debug(`reducer( ${request.type} )`)
  const { type, payload } = request

  switch (type) {
    case '@@PING':
      return pingReducer(request)
    case '@@SPAWN':
      return spawnReducer(request)
    case '@@CONNECT':
      return connectReducer(request)
    case '@@UPLINK':
      return uplinkReducer(request)
    case '@@GENESIS':
      return genesisReducer(request)
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

const pulseReducer = async (type, payload) => {
  let [pulse, setPulse] = usePulse()
  switch (type) {
    case '@@ADD_CHILD': {
      let { alias, spawnOptions } = payload
      if (!alias) {
        alias = await autoAlias(pulse.getNetwork())
      }
      pulse = await pulse.addChild(alias, spawnOptions)
      setPulse(pulse)
      const { address } = await pulse.getNetwork().getChild(alias)
      assert(address instanceof Address)
      assert(address.isRemote())
      const chainId = address.getChainId()
      return { alias, chainId }
    }
    default:
      throw new Error(`Unrecognized type: ${type}`)
  }
}

export { actions, reducer, openPaths }
