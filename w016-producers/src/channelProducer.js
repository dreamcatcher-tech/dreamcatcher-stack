const assert = require('assert')
const debug = require('debug')('interblock:producers:channel')
const _ = require('lodash')
const {
  addressModel,
  channelModel,
  interblockModel,
  actionModel,
  continuationModel,
} = require('../../w015-models')

const ingestInterblock = (channel, interblock) =>
  // TODO do some logic on the channel counts, and if they match ours ?
  // check this transmission naturally extends the remote transmission ?
  // handle validator change in lineage
  channelModel.clone(channel, (draft) => {
    debug('ingestInterblock')
    // TODO if genesis or config change, set the validators
    assert(interblockModel.isModel(interblock))
    assert(channel.address.equals(interblock.provenance.getAddress()))
    const { provenance } = interblock
    const integrity = provenance.reflectIntegrity()
    const remote = interblock.getRemote()
    const light = interblock.getWithoutRemote()
    const immerLineage = [...channel.lineage]
    const pushLight = () => {
      immerLineage.push(integrity)
      draft.lineageTip.push(light)
      draft.lineageHeight = provenance.height
      debug(`ingested lineage: ${provenance.height}`)
    }
    const pushHeavy = () => {
      draft.heavy = interblock
      draft.heavyHeight = provenance.height
      assert(remote || provenance.address.isGenesis())
      if (remote) {
        const { requests } = remote
        const remoteRequestsKeys = Object.keys(requests)
        const reducedReplies = _.pick(draft.replies, remoteRequestsKeys)
        draft.replies = reducedReplies
        debug(`ingested heavy: ${provenance.height}`)
      }
    }
    const last = _.last(channel.lineageTip)
    if (!last) {
      if (provenance.address.isGenesis()) {
        debug(`ingesting genesis`)
        pushLight()
        pushHeavy()
      }
    } else if (last.provenance.isNext(provenance)) {
      pushLight()
    }
    if (remote && draft.heavy) {
      if (provenance.height > draft.heavy.provenance.height) {
        if (immerLineage.some((parent) => parent.equals(integrity))) {
          // if can access prior blocks easily, can avoid the 'lineage' key
          pushHeavy()
        }
      }
    }
    draft.lineage = immerLineage
  })
const ingestPierceInterblock = (channel, interblock) =>
  channelModel.clone(channel, (draft) => {
    // special ingestion that avoids checks of previous blocks
    // TODO try merge with existing ingestion
    assert(interblockModel.isModel(interblock))
    const { provenance } = interblock
    assert(channel.address.equals(provenance.getAddress()))
    const remote = interblock.getRemote()
    assert(remote)
    debug(`ingestPierceInterblock`)

    draft.heavy = interblock
    draft.heavyHeight = provenance.height
    draft.lineageHeight = provenance.height
    const { requests } = remote
    const remoteRequestsKeys = Object.keys(requests)
    const reducedReplies = _.pick(draft.replies, remoteRequestsKeys)
    draft.replies = reducedReplies
  })
const setAddress = (channel, address) =>
  channelModel.clone(channel, (draft) => {
    // TODO if changing address, flush all channels
    assert(addressModel.isModel(address))
    assert(!address.isGenesis())
    draft.address = address
  })

// entry point for covenant into system
const txRequest = (channel, action) =>
  channelModel.clone(channel, (draft) => {
    debug('txRequest')
    assert(actionModel.isModel(action), `must supply request object`)
    // TODO decide if should allow actions to initiate channels just by asking to talk to them
    // may cause problems during promises if channel removed, then replayed
    const requests = Object.values(channel.requests)
    const isDuplicate = requests.some((request) => request.equals(action))
    if (isDuplicate) {
      const msg = `Duplicate request found: ${action.type}.  All requests must be distinguishable from each other`
      throw new Error(msg)
    }
    const index = draft.requestsLength
    draft.requests[index] = action
    // TODO remove requestsLength and simply use highest known index
    draft.requestsLength++
  })

// entry point for covenant into system
const txReply = (channel, reply, replyIndex) =>
  channelModel.clone(channel, (draft) => {
    assert(continuationModel.isModel(reply), `must supply reply object`)
    const nextReplyIndex = channel.getNextReplyIndex()
    // TODO replies during promises needs to be deduplicated
    replyIndex = Number.isInteger(replyIndex) ? replyIndex : nextReplyIndex
    const highestRequest = _.last(channel.getRemoteRequestIndices())
    const isInbounds = replyIndex >= 0 && replyIndex <= highestRequest
    assert(isInbounds, `replyIndex out of bounds: ${replyIndex}`)
    assert(channel.getRemote().requests[replyIndex])

    const { replies } = channel
    const existingReply = replies[replyIndex]
    const isTip = nextReplyIndex === replyIndex
    if (existingReply && !existingReply.isPromise()) {
      throw new Error(`Can only settle previous promises: ${replyIndex}`)
    }
    if (reply.isPromise() && !isTip) {
      throw new Error(`Can only promise for current action: ${replyIndex}`)
    }
    if (!existingReply && !isTip) {
      throw new Error(`Can only settle directly with tip: ${reply}`)
    }
    draft.replies[replyIndex] = reply
  })

const shiftTxRequest = (channel, originalLoopback) =>
  channelModel.clone(channel, (draft) => {
    assert(channelModel.isModel(channel))
    assert(channel.rxReply())

    debug(`shiftTxRequest requestsLength: ${channel.requestsLength}`)
    const isLoopback = channel.systemRole === '.'
    let index = channel.rxReplyIndex()
    if (isLoopback) {
      // loopback crossover is the only way the replies array change during execution
      assert(channelModel.isModel(originalLoopback))
      assert(originalLoopback.address.isLoopback())
      index = originalLoopback.rxReplyIndex()
      assert(channel.replies[index], `loopback empty at ${index}`)
      delete draft.replies[index]
    }
    assert(channel.requests[index], `nothing to remove at ${index}`)
    delete draft.requests[index]
  })

module.exports = {
  ingestInterblock,
  ingestPierceInterblock,
  setAddress,
  txRequest,
  txReply,
  shiftTxRequest,
}
