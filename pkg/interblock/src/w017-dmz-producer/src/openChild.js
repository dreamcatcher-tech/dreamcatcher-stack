import assert from 'assert-fast'
import posix from 'path-browserify'
import {
  actionModel,
  networkModel,
  rxRequestModel,
  rxReplyModel,
  dmzModel,
} from '../../w015-models'
import { channelProducer } from '../../w016-producers'
import {
  replyPromise,
  replyResolve,
  replyReject,
  effectInBand,
  interchain,
} from '../../w002-api'
import { uplink } from './uplink'
import { connect } from './connect'
import Debug from 'debug'
const debug = Debug('interblock:dmz:openChild')

const openChild = (child, parent, fullPath) => ({
  // parent and fullPath are required for continuation,
  // because we do not have dmz promises yet
  type: '@@OPEN_CHILD',
  payload: { child, parent, fullPath },
})
const openChildReducer = (dmz, rxRequest) => {
  assert(dmzModel.isModel(dmz))
  assert(rxRequestModel.isModel(rxRequest))

  const { child, parent, fullPath } = rxRequest.payload
  assert.strictEqual(typeof child, 'string')
  debug(`reducer child: %o parent: %o fullPath: %o`, child, parent, fullPath)
  const channel = dmz.network[child]
  if (!channel) {
    replyReject(new Error(`Alias not found: ${child}`))
  } else if (channel.address.isUnknown()) {
    replyReject(new Error(`Alias unresolved: ${child}`))
  } else if (channel.systemRole !== './') {
    replyReject(new Error(`Alias found, but is not child: ${child}`))
  } else {
    const chainId = rxRequest.getAddress().getChainId()
    const connect = uplink(chainId, rxRequest)
    interchain(connect, child)
    // TODO who handles ACL for opening child ?
    replyPromise()
  }
}
const openChildReply = (network, reply) => {
  assert(networkModel.isModel(network))
  assert(rxReplyModel.isModel(reply))
  const { child, parent, fullPath } = reply.request.payload
  assert.strictEqual(typeof fullPath, 'string')
  switch (reply.type) {
    case '@@RESOLVE': {
      const { chainId } = reply.payload
      debug(`reply received for @@OPEN_CHILD: %o`, chainId.substring(0, 9))
      // TODO move to using network and action sequence to discover fullPath
      const alias = parent + '/' + child
      debug(`connecting to: `, alias)
      // TODO run connect directly here
      interchain(connect(alias, chainId))
      break
    }
    case '@@REJECT': {
      debug(`reject child: %o parent: %o fullPath: %o`, child, parent, fullPath)
      const normalized = posix.normalize(fullPath)
      assert.strictEqual(normalized, fullPath)
      const channel = channelProducer.invalidate(network[fullPath])
      network = networkModel.clone({ ...network, [fullPath]: channel })
      break
    }
    default:
      throw new Error(`Invalid action type: ${reply.type}`)
  }
  return network
}
const openPaths = (network) => {
  // TODO if we have a subpath, should jump ahead to that
  // eg: for /a/b/c/d we might have /a/b already, so should use that first
  assert(networkModel.isModel(network))
  const nextNetwork = {}
  const aliases = network.getAliases()
  const unresolved = aliases.filter((alias) =>
    network[alias].address.isUnknown()
  )
  for (const fullPath of unresolved) {
    if (fullPath === '.@@io' || !fullPath.includes('/')) {
      return // local paths are invalidated separately
    }
    const segmentPaths = _getPathSegments(fullPath)
    assert(segmentPaths.length > 1)

    segmentPaths.some((segmentPath, index) => {
      const channel = network[segmentPath]
      if (channel && !channel.address.isUnknown()) {
        return
      }
      debug(`unresolved path: `, segmentPath)
      if (index === 0) {
        if (!network[segmentPath]) {
          nextNetwork[fullPath] = channelProducer.invalidate(network[fullPath])
          return true
        }
      }

      const parent = index === 0 ? '.' : segmentPaths[index - 1]
      debug('parent: ', parent)
      const child = segmentPath.split('/').pop()
      debug('child: ', child)
      if (_isAwaitingOpen(network[parent], fullPath)) {
        debug(`parent: %o was already asked to open child: %o`, parent, child)
      } else {
        const isUnresolvedParent = network[parent].address.isResolved()
        assert(isUnresolvedParent, `unresolved parent attempted: ${parent}`)
        debug('sending open action from parent: %o to %o', parent, child)
        const open = actionModel.create(openChild(child, parent, fullPath))
        // store some state in meta so can trace this action back
        nextNetwork[parent] = channelProducer.txRequest(network[parent], open)
      }
      return true
    })
  }
  return network.merge(nextNetwork)
}
const _isAwaitingOpen = (channel, fullPath) => {
  // TODO WARNING must consider all paths that are its parent too
  // WARNING consider rejected path as awaiting also ?
  // rxPromises contains a promise in it ?
  for (const request of channel.requests) {
    if (request.type === '@@OPEN_CHILD') {
      return true
    }
  }
  if (channel.rxPromises) {
    return true
  }
  // TODO figure out if some requests have been unreplied to ?
  // store the status of the ask in the meta object
  // if (rep && !rep.isPromise()) {
  //   return
  // }
  // if (req.type !== '@@OPEN_CHILD') {
  //   return
  // }
  // return req.payload.fullPath === fullPath
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
export { openChild, openChildReducer, openChildReply, openPaths }
