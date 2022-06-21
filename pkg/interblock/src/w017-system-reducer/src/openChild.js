import assert from 'assert-fast'
import posix from 'path-browserify'
import { RxRequest, RxReply, Dmz, Meta } from '../../w008-ipld'
import { interchain } from '../../w002-api'
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
  assert(dmz instanceof Dmz)
  assert(rxRequest instanceof RxRequest)
  let { meta } = dmz
  const { child, parent, fullPath } = rxRequest.payload
  assert.strictEqual(typeof child, 'string')
  debug(`reducer child: %o parent: %o fullPath: %o`, child, parent, fullPath)
  let channel = dmz.network.get(child)
  if (!channel) {
    replyReject(new Error(`Alias not found: ${child}`))
  } else if (channel.address.isUnknown()) {
    replyReject(new Error(`Alias unresolved: ${child}`))
  } else if (channel.systemRole !== './') {
    replyReject(new Error(`Alias found, but is not child: ${child}`))
  } else {
    const requestingChainId = rxRequest.getAddress().getChainId()
    const connect = Action.create(uplink(requestingChainId))
    // TODO who handles ACL for opening child ?
    const chainId = channel.address.getChainId()
    const height = dmz.getCurrentHeight()
    const index = channel.requests.length
    const identifier = `${chainId}_${height}_${index}`
    const slice = { type: '@@UPLINK', chainId, origin: rxRequest.identifier }
    meta = metaProducer.withSlice(meta, identifier, slice)
    channel = channelProducer.txRequest(channel, connect)
    replyPromise()
    const network = dmz.network.set(child, channel)
    dmz = dmz.update({ network, meta })
  }
  return dmz
}
const openChildReply = (metaSlice, reply, dmz) => {
  assert.strictEqual(typeof metaSlice, 'object')
  assert(reply instanceof RxReply)
  assert(dmz instanceof Dmz)
  const { child, segment, fullPath } = metaSlice
  assert.strictEqual(typeof fullPath, 'string')
  switch (reply.type) {
    case '@@RESOLVE': {
      const { chainId } = reply.payload
      debug(`reply received for @@OPEN_CHILD: %o`, chainId.substring(0, 9))
      // TODO move to using network and action sequence to discover fullPath
      const alias = segment + '/' + child
      assert(dmz.network.get(alias), `Alias not found: ${alias}`)
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
      const channel = channelProducer.invalidate(dmz.network.get(fullPath))
      const network = dmz.network.set(fullPath, channel)
      return dmz.update({ network })
    }
    default:
      throw new Error(`Invalid action type: ${reply.type}`)
  }
}
const openPaths = (dmz) => {
  // TODO if we have a subpath, should jump ahead to that
  // eg: for /a/b/c/d we might have /a/b already, so should use that first
  assert(dmz instanceof Dmz)
  let { network, meta } = dmz
  const unresolved = network.getUnresolvedAliases()
  for (const fullPath of unresolved) {
    if (fullPath === '.@@io' || !fullPath.includes('/')) {
      continue // local paths are invalidated separately
    }
    const segmentPaths = _getPathSegments(fullPath)
    assert(segmentPaths.length > 1)

    segmentPaths.some((segmentPath, index) => {
      const channel = network.get(segmentPath)
      if (channel && !channel.address.isUnknown()) {
        return false
      }
      debug(`unresolved path: `, segmentPath)
      if (index === 0) {
        if (!network.has(segmentPath)) {
          let channel = network.get(fullPath)
          channel = channelProducer.invalidate(channel)
          network = network.set(fullPath, channel)
          return true
        }
      }

      const segment = index === 0 ? '.' : segmentPaths[index - 1]
      debug('parent: ', segment)
      const child = segmentPath.split('/').pop()
      debug('child: ', child)
      const segChannel = network.get(segment)
      if (_isAwaitingOpen(meta, segment)) {
        debug(`parent: %o was already asked to open child: %o`, segment, child)
      } else {
        const isUnresolvedSeg = segChannel.address.isResolved()
        assert(isUnresolvedSeg, `unresolved parent attempted: ${segment}`)
        debug('sending open action from parent: %o to %o', segment, child)
        const open = Action.create(openChild(child, segment, fullPath))
        const chainId = segChannel.address.getChainId()
        const height = dmz.getCurrentHeight()
        const index = segChannel.requests.length
        const identifier = `${chainId}_${height}_${index}`
        const slice = { type: '@@OPEN_CHILD', child, segment, fullPath }
        meta = metaProducer.withSlice(meta, identifier, slice)
        const openedChannel = channelProducer.txRequest(segChannel, open)
        network = network.set(segment, openedChannel)
      }
      return true
    })
  }
  return dmz.update({ network, meta })
}
const _isAwaitingOpen = (meta, segment) => {
  // TODO WARNING must consider all paths that are its parent too
  // WARNING consider rejected path as awaiting also ?
  assert(meta instanceof Meta)
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
