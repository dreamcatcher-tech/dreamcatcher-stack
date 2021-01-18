const debug = require('debug')('interblock:dmz:genesis')
const { replyResolve } = require('../../w002-api')
const { blockModel } = require('../../w015-models')

const genesisReducer = (network, action) => {
  // TODO check can only have come from parent, and must be the first action in the channel
  // auto respond will resolve this action
}
const genesisReply = (action) => {
  const request = action.getRequest()
  // TODO lighten size of actions by storing origin in state ?
  const { genesis, alias, originAction } = request.payload
  const genesisModel = blockModel.clone(genesis)
  const payload = { alias, chainId: genesisModel.getChainId() }
  if (originAction.sequence) {
    replyResolve(payload, originAction)
  }
  debug('reply received for @@GENESIS')
}
module.exports = { genesisReducer, genesisReply }
