import assert from 'assert-fast'
import posix from 'path-browserify'
import {
  actionModel,
  rxRequestModel,
  rxReplyModel,
  dmzModel,
  metaModel,
} from '../../w015-models'
import { channelProducer, metaProducer } from '../../w016-producers'
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
  let { meta } = dmz
  const { child, parent, fullPath } = rxRequest.payload
  assert.strictEqual(typeof child, 'string')
  debug(`reducer child: %o parent: %o fullPath: %o`, child, parent, fullPath)
  let channel = dmz.network[child]
  if (!channel) {
    replyReject(new Error(`Alias not found: ${child}`))
  } else if (channel.address.isUnknown()) {
    replyReject(new Error(`Alias unresolved: ${child}`))
  } else if (channel.systemRole !== './') {
    replyReject(new Error(`Alias found, but is not child: ${child}`))
  } else {
    const requestingChainId = rxRequest.getAddress().getChainId()
    const connect = actionModel.create(uplink(requestingChainId))
    // TODO who handles ACL for opening child ?
    const chainId = channel.address.getChainId()
    const height = dmz.getCurrentHeight()
    const index = channel.requests.length
    const identifier = `${chainId}_${height}_${index}`
    const slice = { type: '@@UPLINK', chainId, origin: rxRequest.identifier }
    meta = metaProducer.withSlice(meta, identifier, slice)
    channel = channelProducer.txRequest(channel, connect)
    replyPromise()
    const network = { ...dmz.network, [child]: channel }
    dmz = dmzModel.clone({ ...dmz, network, meta })
  }
  return dmz
}
const openChildReply = (slice, reply, dmz) => {
  assert.strictEqual(typeof slice, 'object')
  assert(rxReplyModel.isModel(reply))
  assert(dmzModel.isModel(dmz))
  const { child, segment, fullPath } = slice
  assert.strictEqual(typeof fullPath, 'string')
  switch (reply.type) {
    case '@@RESOLVE': {
      const { chainId } = reply.payload
      debug(`reply received for @@OPEN_CHILD: %o`, chainId.substring(0, 9))
      // TODO move to using network and action sequence to discover fullPath
      const alias = segment + '/' + child
      assert(dmz.network[alias], `Alias not found: ${alias}`)
      debug(`connecting to: `, alias)
      // TODO run connect directly here
      interchain(connect(alias, chainId))
      return dmz
    }
    case '@@REJECT': {
      debug(
        `reject child: %o parent: %o fullPath: %o`,
        child,
        segment,
        fullPath
      )
      const normalized = posix.normalize(fullPath)
      assert.strictEqual(normalized, fullPath)
      const channel = channelProducer.invalidate(dmz.network[fullPath])
      const network = dmz.network.merge({ [fullPath]: channel })
      return dmzModel.clone({ ...dmz, network })
    }
    default:
      throw new Error(`Invalid action type: ${reply.type}`)
  }
}
const openPaths = (dmz) => {
  // TODO if we have a subpath, should jump ahead to that
  // eg: for /a/b/c/d we might have /a/b already, so should use that first
  assert(dmzModel.isModel(dmz))
  let { network } = dmz
  const nextNetwork = {}
  const aliases = network.getAliases()
  const unresolved = aliases.filter((alias) =>
    network[alias].address.isUnknown()
  )
  let { meta } = dmz
  for (const fullPath of unresolved) {
    if (fullPath === '.@@io' || !fullPath.includes('/')) {
      continue // local paths are invalidated separately
    }
    const segmentPaths = _getPathSegments(fullPath)
    assert(segmentPaths.length > 1)

    segmentPaths.some((segmentPath, index) => {
      const channel = network[segmentPath]
      if (channel && !channel.address.isUnknown()) {
        return false
      }
      debug(`unresolved path: `, segmentPath)
      if (index === 0) {
        if (!network[segmentPath]) {
          nextNetwork[fullPath] = channelProducer.invalidate(network[fullPath])
          return true
        }
      }

      const segment = index === 0 ? '.' : segmentPaths[index - 1]
      debug('parent: ', segment)
      const child = segmentPath.split('/').pop()
      debug('child: ', child)
      const segChannel = network[segment]
      if (_isAwaitingOpen(meta, segment)) {
        debug(`parent: %o was already asked to open child: %o`, segment, child)
      } else {
        const isUnresolvedSeg = segChannel.address.isResolved()
        assert(isUnresolvedSeg, `unresolved parent attempted: ${segment}`)
        debug('sending open action from parent: %o to %o', segment, child)
        const open = actionModel.create(openChild(child, segment, fullPath))
        nextNetwork[segment] = channelProducer.txRequest(segChannel, open)
        const chainId = segChannel.address.getChainId()
        const height = dmz.getCurrentHeight()
        const index = segChannel.requests.length
        const identifier = `${chainId}_${height}_${index}`
        const slice = { type: '@@OPEN_CHILD', child, segment, fullPath }
        meta = metaProducer.withSlice(meta, identifier, slice)
      }
      return true
    })
  }
  network = network.merge(nextNetwork)
  return dmzModel.clone({ ...dmz, network, meta })
}
const _isAwaitingOpen = (meta, segment) => {
  // TODO WARNING must consider all paths that are its parent too
  // WARNING consider rejected path as awaiting also ?
  assert(metaModel.isModel(meta))
  assert.strictEqual(typeof segment, 'string')
  for (const slice of Object.values(meta.replies)) {
    if (slice.segment === segment) {
      return true
    }
  }
  return false
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
