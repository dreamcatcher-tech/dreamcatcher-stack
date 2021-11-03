import { interchain, replyResolve } from '../../w002-api'
import { rxReplyModel } from '../../w015-models'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('interblock:dmz:genesis')

const genesisReducer = (network, action) => {
  // TODO check can only have come from parent, and must be the first action in the channel
  // auto respond will resolve this action
  // TODO wait for response from covenant, in case rejected

  // TODO insert the action directly into the network, and store the request id
  interchain('@@INIT') // covenant, take your first breath
}
const genesisReply = (meta, reply) => {
  // TODO update whole reply to use dmz meta state
  assert.strictEqual(typeof meta, 'object')
  assert(rxReplyModel.isModel(reply))

  const { alias, chainId, originIdentifier } = meta
  debug('reply received for @@GENESIS', alias, chainId, originIdentifier)
  replyResolve({ alias, chainId }, originIdentifier)
}
export { genesisReducer, genesisReply }
