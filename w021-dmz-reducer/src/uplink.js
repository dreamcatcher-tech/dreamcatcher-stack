const assert = require('assert')
const debug = require('debug')('interblock:dmz:uplink')
const { replyResolve } = require('../../w002-api')
const {
  networkModel,
  addressModel,
  channelModel,
} = require('../../w015-models')
const { autoAlias } = require('./utils')

const uplink = (chainId, originAction) => ({
  type: '@@UPLINK',
  payload: { chainId, originAction }, // TODO replace with generic promise hook
})
const uplinkReducer = (network, action) =>
  networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    const { chainId } = action.payload
    assert(chainId) // TODO test against regex
    const address = addressModel.create(chainId)
    assert.strictEqual(address.getChainId(), chainId)
    assert(address.isResolved())

    let alias = network.getAlias(address)
    if (!alias || network[alias].systemRole !== 'UP_LINK') {
      alias = autoAlias(network, '.uplink_')
      assert(!network[alias])
      draft[alias] = channelModel.create(address, 'UP_LINK')
    }
    const shortChainId = chainId.substring(0, 9)
    debug(`uplinkReducer ${alias} set to ${shortChainId}`)
    replyResolve({ alias })
  })
const uplinkReply = (network, reply) => {
  const { originAction } = reply.getRequest().payload
  switch (reply.type) {
    case '@@RESOLVE':
      const { child } = originAction.payload
      debug('reply: ', child)
      const chainId = network[child].address.getChainId()
      const payload = { chainId }
      replyResolve(payload, originAction)
      break
    case '@@REJECT':
      debug('reject: ', reply)
      replyReject(reply.payload, originAction)
      break
  }
}

module.exports = { uplink, uplinkReducer, uplinkReply }
