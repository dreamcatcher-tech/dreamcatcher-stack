import assert from 'assert-fast'
import { replyResolve, replyReject } from '../../w002-api'
import { Address, Channel, Dmz, RxRequest, RxReply } from '../../w015-models'
import { autoAlias } from './utils'
import Debug from 'debug'
const debug = Debug('interblock:dmz:uplink')

const uplink = (chainId) => ({
  type: '@@UPLINK',
  payload: { chainId }, // TODO replace with generic promise hook
})
const uplinkReducer = (dmz, rxRequest) => {
  assert(dmz instanceof Dmz)
  assert(rxRequest instanceof RxRequest)
  const { network } = dmz
  const { chainId } = rxRequest.payload
  assert(chainId) // TODO test against regex
  const address = Address.create(chainId)
  assert.strictEqual(address.getChainId(), chainId)
  assert(address.isResolved())

  let alias = network.getAlias(address)
  const nextNetwork = {}
  if (!alias || network[alias].systemRole !== 'UP_LINK') {
    alias = autoAlias(network, '.uplink_')
    assert(!network[alias])
    nextNetwork[alias] = Channel.create(address, 'UP_LINK')
  }
  const shortChainId = chainId.substring(0, 9)
  debug(`uplinkReducer ${alias} set to ${shortChainId}`)
  replyResolve()
  return Dmz.clone({ ...dmz, network: network.merge(nextNetwork) })
}
const uplinkReply = (slice, rxReply, dmz) => {
  assert.strictEqual(typeof slice, 'object')
  assert.strictEqual(slice.type, '@@UPLINK')
  assert(rxReply instanceof RxReply)
  assert(dmz instanceof Dmz)
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
