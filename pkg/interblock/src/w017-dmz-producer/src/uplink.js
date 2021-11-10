import assert from 'assert-fast'
import { replyResolve, replyReject } from '../../w002-api'
import {
  addressModel,
  channelModel,
  dmzModel,
  rxRequestModel,
  rxReplyModel,
} from '../../w015-models'
import { autoAlias } from './utils'
import Debug from 'debug'
const debug = Debug('interblock:dmz:uplink')

const uplink = (chainId) => ({
  type: '@@UPLINK',
  payload: { chainId }, // TODO replace with generic promise hook
})
const uplinkReducer = (dmz, rxRequest) => {
  assert(dmzModel.isModel(dmz))
  assert(rxRequestModel.isModel(rxRequest))
  const { network } = dmz
  const { chainId } = rxRequest.payload
  assert(chainId) // TODO test against regex
  const address = addressModel.create(chainId)
  assert.strictEqual(address.getChainId(), chainId)
  assert(address.isResolved())

  let alias = network.getAlias(address)
  const nextNetwork = {}
  if (!alias || network[alias].systemRole !== 'UP_LINK') {
    alias = autoAlias(network, '.uplink_')
    assert(!network[alias])
    nextNetwork[alias] = channelModel.create(address, 'UP_LINK')
  }
  const shortChainId = chainId.substring(0, 9)
  debug(`uplinkReducer ${alias} set to ${shortChainId}`)
  replyResolve()
  return dmzModel.clone({ ...dmz, network: network.merge(nextNetwork) })
}
const uplinkReply = (slice, rxReply, dmz) => {
  assert.strictEqual(typeof slice, 'object')
  assert.strictEqual(slice.type, '@@UPLINK')
  assert(rxReplyModel.isModel(rxReply))
  assert(dmzModel.isModel(dmz))
  const { chainId, origin } = slice
  assert.strictEqual(typeof chainId, 'string')
  assert.strictEqual(typeof origin, 'string')

  switch (rxReply.type) {
    case '@@RESOLVE': {
      debug('reply: ', chainId.substring(0, 9))
      const payload = { chainId }
      replyResolve(payload, origin)
      break
    }
    case '@@REJECT':
      debug('reject: ', rxReply)
      replyReject(rxReply.payload, origin)
      break
  }
}

export { uplink, uplinkReducer, uplinkReply }
