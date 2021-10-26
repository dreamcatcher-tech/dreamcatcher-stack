import { interchain, replyResolve } from '../../w002-api'
import { blockModel } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:dmz:genesis')

const genesisReducer = (network, action) => {
  // TODO check can only have come from parent, and must be the first action in the channel
  // auto respond will resolve this action
  // TODO wait for response from covenant, in case rejected

  // TODO insert the action directly into the network, and store the request id
  interchain('@@INIT') // covenant, take your first breath
}
const genesisReply = (action) => {
  // TODO update whole reply to use dmz meta state
  const request = action.getRequest()
  // TODO lighten size of actions by storing origin in state ?
  const { genesis, alias, originAction } = request.payload
  const genesisModel = blockModel.clone(genesis)
  const payload = { alias, chainId: genesisModel.getChainId() }
  if (originAction.identifier) {
    // TODO when would this ever be false ?
    replyResolve(payload, originAction)
  }
  debug('reply received for @@GENESIS')
}
export { genesisReducer, genesisReply }
