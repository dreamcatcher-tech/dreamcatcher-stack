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

const _ingestInterblock = (channel, interblock) =>
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
      draft.lineage.push(integrity)
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
        debug(`ingested genesis`)
        pushLight()
        pushHeavy()
      }
    } else if (last.provenance.isNext(provenance)) {
      pushLight()
    }
    if (remote && draft.heavy) {
      if (provenance.height > draft.heavy.provenance.height) {
        if (immerLineage.includes(integrity)) {
          // if can access prior blocks easily, can avoid the 'lineage' key
          pushHeavy()
        }
      }
    }
  })
const ingestInterblock = _.memoize(
  // no noticeable improvement
  _ingestInterblock,
  (channel, interblock) => `${channel.getHash()}_${interblock.getHash()}`
)

const setAddress = (channel, address) =>
  channelModel.clone(channel, (draft) => {
    // TODO if changing address, flush all channels
    assert(addressModel.isModel(address))
    assert(!address.isGenesis())
    draft.address = address
  })

// TODO check no duplicate reads
// entry point for covenant into system
const txRequest = (channel, action) =>
  channelModel.clone(channel, (draft) => {
    debug('txRequest')
    assert(actionModel.isModel(action), `must supply request object`)
    const index = draft.requestsLength
    draft.requests[index] = action
    draft.requestsLength++
  })

// entry point for covenant into system
const txReply = (channel, reply, replyIndex) =>
  channelModel.clone(channel, (draft) => {
    assert(continuationModel.isModel(reply), `must supply reply object`)
    const nextReplyIndex = channel.getNextReplyIndex()

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

const shiftTxRequest = (channel) =>
  channelModel.clone(channel, (draft) => {
    assert(channel.rxReply())
    debug(`shiftTxRequest requestsLength: ${channel.requestsLength}`)
    const index = channel.rxReplyIndex()
    assert(channel.requests[index], `nothing to remove at ${index}`)
    delete draft.requests[index]
    if (channel.systemRole === '.') {
      delete draft.replies[index]
    }
  })

module.exports = {
  ingestInterblock,
  setAddress,
  txRequest,
  txReply,
  shiftTxRequest,
}
