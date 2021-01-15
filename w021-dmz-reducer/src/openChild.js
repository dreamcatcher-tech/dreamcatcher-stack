const assert = require('assert')
const posix = require('path')
const debug = require('debug')('interblock:dmz:openChild')
const {
  actionModel,
  networkModel,
  rxRequestModel,
  rxReplyModel,
} = require('../../w015-models')
const { channelProducer } = require('../../w016-producers')
const {
  replyPromise,
  replyResolve,
  replyReject,
  isReplyFor,
  effectInBand,
  interchain,
} = require('../../w002-api')
const { uplink } = require('./uplink')
const { connect } = require('./connect')

const openChild = (alias, fullPath) => ({
  type: '@@OPEN_CHILD',
  payload: { alias, fullPath },
})
const openChildReducer = (network, request) => {
  assert(rxRequestModel.isModel(request))

  const { alias } = request.payload
  assert.strictEqual(typeof alias, 'string')
  debug(`openChildReducer`, alias)
  const channel = network[alias]
  if (!channel) {
    replyReject(new Error(`Alias not found: ${alias}`))
  } else if (channel.address.isUnknown()) {
    replyReject(new Error(`Alias unresolved: ${alias}`))
  } else if (channel.systemRole !== './') {
    replyReject(new Error(`Alias found, but is not child: ${alias}`))
  } else {
    const chainId = request.getAddress().getChainId()
    const connect = uplink(chainId, request)
    interchain(connect, alias)
    // TODO who handles ACL for opening child ?
    replyPromise()
  }
}
const openChildReply = (network, reply) => {
  assert(networkModel.isModel(network))
  assert(rxReplyModel.isModel(reply))
  const { fullPath } = reply.request.payload
  switch (reply.type) {
    case '@@RESOLVE':
      const { chainId } = reply.payload
      debug(`reply received for @@OPEN_CHILD: %o`, chainId.substring(0, 9))
      // TODO move to using network and action sequence to discover fullPath
      interchain(connect(fullPath, chainId))
      break
    case '@@REJECT':
      debug(`rejection received`, fullPath)
      const respondent = posix.parse(fullPath).dir
      assert(network[respondent])
      const channel = channelProducer.invalidate(network[fullPath])
      network = networkModel.clone({ ...network, [fullPath]: channel })
      break
    default:
      throw new Error(`Invalid action type: ${reply.type}`)
  }
  return network
}
const openPaths = (network) =>
  networkModel.clone(network, (draft) => {
    // TODO if we have a subpath, should jump ahead to that
    // eg: for /a/b/c/d we might have /a/b already, so should use that first
    assert(networkModel.isModel(network))
    const aliases = network.getAliases()
    const unresolved = aliases.filter((alias) =>
      network[alias].address.isUnknown()
    )
    unresolved.forEach((alias) => {
      if (alias === '.@@io') {
        return
      }
      if (!alias.includes('/')) {
        return // local paths are invalidated separately
      }

      const paths = _getPathSegments(alias)
      assert(paths.length > 1)

      paths.some((fullPath, index) => {
        const channel = network[fullPath]
        if (channel && !channel.address.isUnknown()) {
          return
        }
        debug(`unresolved path: `, fullPath)
        if (index === 0) {
          if (!network[fullPath]) {
            draft[alias] = channelProducer.invalidate(network[alias])
            return true
          }
        }

        const parent = index === 0 ? '.' : paths[index - 1]
        debug('parent: ', parent)
        const child = fullPath.split('/').pop()
        debug('child: ', child)
        if (_isAwaitingOpen(network[parent])) {
          debug(`parent: %o was already asked to open child: %o`, parent, child)
        } else {
          debug('sending open action from parent: %o to %o', parent, child)
          const open = actionModel.create(openChild(child, fullPath))
          draft[parent] = channelProducer.txRequest(network[parent], open)
        }
        return true
      })
    })
  })
const _isAwaitingOpen = (channel, fullPath) => {
  // TODO WARNING must consider all paths that are its parent too
  // WARNING consider rejected path as awaiting also ?
  const pairs = channel.getOutboundPairs()
  return pairs.some(([req, rep]) => {
    if (rep && !rep.isPromise()) {
      return
    }
    if (req.type !== '@@OPEN_CHILD') {
      return
    }
    return req.payload.fullPath === fullPath
  })
}
const _getPathSegments = (alias) => {
  let prefix = ''
  const paths = alias.split('/').map((segment) => {
    prefix && (prefix += '/') // TODO make child naming convention avoid this check ?
    prefix += segment
    return prefix
  })
  return paths
}
module.exports = { openChild, openChildReducer, openChildReply, openPaths }
