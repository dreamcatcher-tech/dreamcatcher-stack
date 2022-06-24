import assert from 'assert-fast'
import pad from 'pad-left'
import { Channel, Network } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:dmz:utils')

const autoAlias = async (network, autoPrefix = 'file_') => {
  assert(network instanceof Network)
  assert.strictEqual(typeof autoPrefix, 'string')
  let height = 0
  let alias
  do {
    height++
    alias = autoPrefix + pad(height, 5, '0')
  } while (await network.hasChannel(alias))
  return alias
}
const getChannelParams = (network, alias) => {
  const channel = network.get(alias)
  assert(channel instanceof Channel, `Not channel: ${alias}`)
  const { address, systemRole, tipHeight, tip } = channel
  let chainId = address.isResolved() ? address.getChainId() : 'UNRESOLVED'
  chainId = address.isRoot() ? 'ROOT' : chainId
  const params = { systemRole, chainId }
  if (tip) {
    params.hash = tip.hash
    params.height = tipHeight
  }
  return params
}
const listChildren = (block) => {
  assert(block instanceof Block)
  const children = {}
  for (const [alias] of block.network.entries()) {
    children[alias] = getChannelParams(block.network, alias)
  }
  const self = children['.']
  self.chainId = block.getChainId()
  self.height = block.getHeight()
  self.hash = block.hashString()
  const parent = block.network.getParent()
  if (parent.address.isRoot()) {
    self.remoteName = '/'
  }
  return children
}
export { autoAlias, getChannelParams, listChildren }
