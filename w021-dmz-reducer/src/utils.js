const assert = require('assert')
const debug = require('debug')('interblock:dmz:utils')
const pad = require('pad/dist/pad.umd')
const { channelModel } = require('../../w015-models')

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
  return autoPrefix + pad(5, highest + 1, '0')
}
const getChannelParams = (network, alias) => {
  const channel = network[alias]
  assert(channelModel.isModel(channel))
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
    remoteName = heavy.getOriginAlias()
    remoteName && (params.remoteName = remoteName)
  }
  return params
}
module.exports = { autoAlias, getChannelParams }
