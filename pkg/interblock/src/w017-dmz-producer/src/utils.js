import assert from 'assert-fast'
import pad from 'pad-left'
import { Block, Channel } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:dmz:utils')

const autoAlias = (network, autoPrefix = 'file_') => {
  // TODO get highest current auto, and always return higher
  let highest = 0
  network.getAliases().forEach((alias) => {
    if (alias.startsWith(autoPrefix)) {
      try {
        const count = parseInt(alias.substring(autoPrefix.length))
        highest = count > highest ? count : highest
      } catch (e) {
        debug(`autoAlias error: `, e)
        throw e
      }
    }
  })
  return autoPrefix + pad(highest + 1, 5, '0')
}
const getChannelParams = (network, alias) => {
  const channel = network[alias]
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
  block.network.getAliases().forEach((alias) => {
    children[alias] = getChannelParams(block.network, alias)
  })
  const self = children['.']
  self.chainId = block.getChainId()
  self.height = block.getHeight()
  self.hash = block.getHash()
  const parent = block.network.getParent()
  if (parent.address.isRoot()) {
    self.remoteName = '/'
  }
  return children
}
export { autoAlias, getChannelParams, listChildren }
