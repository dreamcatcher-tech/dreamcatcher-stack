import assert from 'assert-fast'
import { replyResolve, replyReject } from '../../w002-api'
import { networkModel, addressModel, channelModel } from '../../w015-models'
import { autoAlias } from './utils'
import Debug from 'debug'
const debug = Debug('interblock:dmz:uplink')

const uplink = (chainId, originAction) => ({
  type: '@@UPLINK',
  payload: { chainId, originAction }, // TODO replace with generic promise hook
})
const uplinkReducer = (network, action) => {
  assert(networkModel.isModel(network))
  const { chainId } = action.payload
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
  replyResolve({ alias })
  return networkModel.merge(network, nextNetwork)
}
const uplinkReply = (network, reply) => {
  const { originAction } = reply.getRequest().payload
  switch (reply.type) {
    case '@@RESOLVE': {
      const { child } = originAction.payload
      debug('reply: ', child)
      const chainId = network[child].address.getChainId()
      const payload = { chainId }
      replyResolve(payload, originAction)
      break
    }
    case '@@REJECT':
      debug('reject: ', reply)
      replyReject(reply.payload, originAction)
      break
  }
}

export { uplink, uplinkReducer, uplinkReply }
