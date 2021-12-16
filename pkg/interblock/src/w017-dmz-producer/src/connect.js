import assert from 'assert-fast'
import { Address, Channel, Dmz, RxRequest } from '../../w015-models'
import { channelProducer } from '../../w016-producers'

const connect = (alias, chainId) => ({
  type: '@@CONNECT',
  payload: { alias, chainId },
})
const connectReducer = (dmz, rxRequest) => {
  assert(dmz instanceof Dmz)
  assert(rxRequest instanceof RxRequest)

  const { alias, chainId } = rxRequest.payload
  const address = Address.create(chainId)
  assert(address.isResolved())
  assert.strictEqual(address.getChainId(), chainId)
  assert(alias && typeof alias === 'string')
  let { network } = dmz
  let channel = network[alias] || Channel.create(address)
  // TODO blank the queues if changing address for existing alias ?
  // TODO beware unresolving an already resolved address
  channel = channelProducer.setAddress(channel, address)
  network = network.merge({ [alias]: channel })
  return Dmz.clone({ ...dmz, network })
}
export { connect, connectReducer }
