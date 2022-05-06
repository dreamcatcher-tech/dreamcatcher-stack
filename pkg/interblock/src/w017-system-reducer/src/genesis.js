import {
  interchain,
  replyPromise,
  replyResolve,
  replyReject,
} from '../../w002-api'
import { Dmz, RxReply } from '../../w008-ipld'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('interblock:dmz:genesis')

const genesisReducer = (dmz, action) => {
  assert(dmz instanceof Dmz)
  assert.strictEqual(action.type, '@@GENESIS')
  interchain('@@INIT') // covenant, take your first breath
  replyPromise()
  const chainId = dmz.network.get('.').address.getChainId()
  const height = dmz.getCurrentHeight()
  const index = 0
  const replyIdentifier = `${chainId}_${height}_${index}`
  const slice = {
    type: '@@INIT',
    originIdentifier: action.identifier,
  }
  const meta = metaProducer.withSlice(dmz.meta, replyIdentifier, slice)
  return dmz.update({ meta })
  // TODO check can only have come from parent, and must be the first action in the channel
  // auto respond will resolve this action
  // TODO wait for response from covenant, in case rejected
  // TODO insert the action directly into the network, and store the request id
}
const genesisReply = (meta, reply) => {
  // TODO update whole reply to use dmz meta state
  assert.strictEqual(typeof meta, 'object')
  assert(reply instanceof RxReply)

  const { alias, chainId, originIdentifier } = meta
  debug('reply received for @@GENESIS %O', meta)
  const { type, payload } = reply
  if (type === '@@REJECT') {
    replyReject(payload, originIdentifier)
  } else {
    replyResolve({ alias, chainId }, originIdentifier)
  }
}
const initReply = (meta, reply) => {
  assert.strictEqual(typeof meta, 'object')
  assert(reply instanceof RxReply)
  const { originIdentifier } = meta
  const { type, payload } = reply
  debug('@@INIT reply received', type, originIdentifier)
  if (type === '@@REJECT') {
    replyReject(payload, originIdentifier)
  } else {
    replyResolve(payload, originIdentifier)
  }
}
export { genesisReducer, genesisReply, initReply }
