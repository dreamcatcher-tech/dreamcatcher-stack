const assert = require('assert')
const debug = require('debug')('interblock:dmz:utils')
const pad = require('pad-left')
const { blockModel, channelModel } = require('../../w015-models')

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
  assert(channelModel.isModel(channel), `Not channel: ${alias}`)
  const { address, systemRole, lineageHeight, heavyHeight, heavy } = channel
  let chainId = address.isResolved() ? address.getChainId() : 'UNRESOLVED'
  chainId = address.isRoot() ? 'ROOT' : chainId
  const params = {
    systemRole,
    chainId,
    lineageHeight,
    heavyHeight,
  }
  if (heavy) {
    params.hash = heavy.provenance.reflectIntegrity().hash
    const remoteName = heavy.getOriginAlias()
    if (remoteName) {
      params.remoteName = remoteName
    }
  }
  return params
}
const listChildren = (block) => {
  assert(blockModel.isModel(block))
  const children = {}
  block.network.getAliases().forEach((alias) => {
    children[alias] = getChannelParams(block.network, alias)
  })
  const self = children['.']
  self.chainId = block.getChainId()
  self.lineageHeight = block.getHeight()
  self.heavyHeight = block.getHeight()
  self.hash = block.getHash()
  const parent = block.network.getParent()
  if (parent.address.isRoot()) {
    self.remoteName = '/'
  } else if (parent.heavy) {
    // heavy is not present in genesis blocks
    self.remoteName = parent.heavy.getOriginAlias()
  }
  return children
}
module.exports = { autoAlias, getChannelParams, listChildren }
