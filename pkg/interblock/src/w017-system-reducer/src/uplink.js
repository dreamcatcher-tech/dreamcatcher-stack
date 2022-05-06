import assert from 'assert-fast'
import { replyResolve, replyReject } from '../../w002-api'
import { Address, Channel, Dmz, RxRequest, RxReply } from '../../w008-ipld'
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
  let { network } = dmz
  const { chainId } = rxRequest.payload
  assert(chainId) // TODO test against regex
  const address = Address.create(chainId)
  assert.strictEqual(address.getChainId(), chainId)
  assert(address.isResolved())

  const isUplinkRequired =
    !network.hasByAddress(address) ||
    network.getByAddress(address).systemRole !== 'UP_LINK'
  if (isUplinkRequired) {
    const alias = autoAlias(network, '.uplink_')
    assert(!network.has(alias))
    network = network.set(alias, Channel.create(address, 'UP_LINK'))
    dmz = dmz.update({ network })
  }
  const shortChainId = chainId.substring(0, 9)
  debug(`uplinkReducer set to ${shortChainId}`)
  replyResolve()
  return dmz
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
