import assert from 'assert-fast'
import last from 'lodash.last'
import Debug from 'debug'
const debug = Debug('interblock:producers:channel')
import {
  addressModel,
  channelModel,
  interblockModel,
  actionModel,
  txReplyModel,
} from '../../w015-models'

const ingestInterblocks = (channel, interblocks) => {
  assert(channelModel.isModel(channel))
  assert(Array.isArray(interblocks))
  assert(interblocks.every(interblockModel.isModel))
  interblocks = [...interblocks]
  interblocks.sort((a, b) => a.provenance.height - b.provenance.height)
  // TODO check they are consecutive ?
  // TODO check the precedents match correctly ?

  const ingested = []
  for (const interblock of interblocks) {
    const currentChannel = channel
    // BEWARE channel is a mutable object during this loop
    channel = _ingestInterblock(channel, interblock)
    if (channel === currentChannel) {
      debug(`interblock not ingested`)
      break
    }
    ingested.push(interblock)
  }
  return [channelModel.clone(channel), ingested]
}

const _ingestInterblock = (channel, interblock) => {
  // TODO do some logic on the channel counts, and if they match ours ?
  // check this transmission naturally extends the remote transmission ?
  // handle validator change in lineage
  debug('ingestInterblock')
  assert(interblockModel.isModel(interblock))
  assert(channel.address.equals(interblock.provenance.getAddress()))
  const { provenance, turnovers } = interblock
  const integrity = provenance.reflectIntegrity()
  const remote = interblock.getRemote()

  let { rxRepliesTip, tip, tipHeight } = channel
  assert(_rxRepliesTipHeight(rxRepliesTip) <= provenance.height)

  if (tip && !remote.precedent.equals(tip)) {
    return channel
  }
  if (remote.precedent.isUnknown()) {
    debug(`precedent unknown`)
    assert.strictEqual(typeof tip, 'undefined')
    assert.strictEqual(typeof rxRepliesTip, 'undefined')
    if (provenance.address.isGenesis()) {
      assert(!turnovers)
    } else {
      assert(Array.isArray(turnovers))
      assert(turnovers.length)
      const genesis = turnovers[0]
      assert(genesis.provenance.address.isGenesis())
      assert(genesis.provenance.getAddress().equals(channel.address))
      // TODO handle validators changing at any point
    }
  }
  rxRepliesTip = _getRxRepliesTip(rxRepliesTip, remote.replies)
  tip = integrity
  tipHeight = provenance.height
  const nextChannel = {
    ...channel,
    tip,
    tipHeight,
  }
  if (rxRepliesTip) {
    nextChannel.rxRepliesTip = rxRepliesTip
  }
  return nextChannel
}
const _getRxRepliesTip = (rxRepliesTip, replies) => {
  const keys = Object.keys(replies)
  if (!keys.length) {
    return rxRepliesTip
  }
  const parse = (key) => {
    if (!key) {
      return { height: -1, index: -1 }
    }
    const [sHeight, sIndex] = key.split('_')
    return { height: parseInt(sHeight), index: parseInt(sIndex) }
  }
  let { height: mHeight, index: mIndex } = parse(rxRepliesTip)
  for (const key of keys) {
    const { height, index } = parse(key)
    if (height >= mHeight) {
      if (index > mIndex) {
        mHeight = height
        mIndex = index
      }
    }
  }
  if (mHeight === -1) {
    return rxRepliesTip
  }
  return `${mHeight}_${mIndex}`
}
const _rxRepliesTipHeight = (rxRepliesTip) => {
  if (!rxRepliesTip) {
    return -1
  }
  return parseInt(rxRepliesTip.split('_').pop())
}
const setAddress = (channel, address) => {
  assert(addressModel.isModel(address))
  assert(!address.isGenesis())
  if (channel.address.equals(address)) {
    return channel
  }
  // TODO if changing address, flush all channels
  return channelModel.clone({ ...channel, address })
}

// --------------- REMOVE LINEAGE ---------------

// TODO check requests and replies map to remote correctly

// entry point for covenant into system
const txRequest = (channel, action) => {
  debug('txRequest')
  assert(actionModel.isModel(action), `must supply request object`)
  // TODO decide if should allow actions to initiate channels just by asking to talk to them
  // TODO use immutable map to detect duplicates faster
  let { requests } = channel
  const isDuplicate = requests.some((request) => request.equals(action))
  if (isDuplicate) {
    // TODO move this logic into the channelModel
    const msg =
      `Duplicate request found: ${action.type}. ` +
      `All requests must be distinguishable from each other else ` +
      `isReplyFor( action ) will not work`
    throw new Error(msg)
  }
  requests = [...requests, action]
  return channelModel.clone({ ...channel, requests })
}

// entry point for covenant into system
const txReply = (channel, txReply) => {
  assert(channelModel.isModel(channel))
  assert(txReplyModel.isModel(txReply), `must supply reply object`)
  // TODO how to check that replies sequence is correct ? checked on
  // other side only ?
  const replyKey = txReply.getReplyKey()
  if (channel.replies[replyKey]) {
    assert.strictEqual(channel.replies[replyKey].type, '@@PROMISE')
  }

  let { replies } = channel
  const existingReply = replies[replyKey]
  if (existingReply) {
    if (!existingReply.isPromise()) {
      throw new Error(`Can only settle previous promises: ${replyKey}`)
    }
  }
  const isTip = _isTip(replyKey, replies)
  const reply = txReply.getReply()
  if (reply.isPromise() && !isTip) {
    _isTip(replyKey, replies)
    throw new Error(`Can only promise for tip action: ${replyKey}`)
  }
  if (!existingReply && !isTip) {
    throw new Error(`Can only settle synchronously with tip: ${replyKey}`)
  }
  replies = { ...replies, [replyKey]: reply }
  return channelModel.clone({ ...channel, replies })
}

const shiftTxRequest = (channel, originalLoopback) => {
  assert(channelModel.isModel(channel))
  assert(channel.rxReply())
  debug(`shiftTxRequest requestsLength: ${channel.requestsLength}`)
  let index = channel.rxReplyIndex()
  let { replies, requests } = channel
  if (channel.address.isLoopback()) {
    // loopback crossover is the only possible way the replies array may
    // change during execution.
    // originalLoopback is required to keep track of what things used to be
    // TODO change to get original loopback out of the channel itself
    assert(channelModel.isModel(originalLoopback))
    assert(originalLoopback.address.isLoopback())
    index = originalLoopback.rxReplyIndex()
    assert(channel.replies[index], `loopback empty at ${index}`)
    replies = { ...replies }
    delete replies[index]
  }
  assert(channel.requests[index], `nothing to remove at ${index}`)
  requests = { ...requests }
  delete requests[index]
  return channelModel.clone({ ...channel, replies, requests })
}
const invalidate = (channel) => {
  const invalid = addressModel.create('INVALID')
  return setAddress(channel, invalid)
}

// exit point from system to covenant

const _isTip = (replyKey, replies) => {
  assert.strictEqual(typeof replyKey, 'string')
  assert.strictEqual(typeof replies, 'object')
  const keys = Object.keys(replies)
  if (!keys.length) {
    return true
  }
  let [maxHeight, maxIndex] = _splitParse(keys[0])
  for (const key of keys) {
    const [height, index] = _splitParse(key)
    if (height > maxHeight || (height === maxHeight && index > maxIndex)) {
      maxHeight = height
      maxIndex = index
    }
  }
  const [replyHeight, replyIndex] = _splitParse(replyKey)
  if (replyHeight === maxHeight) {
    return replyIndex === maxIndex + 1
  }
  if (replyHeight === maxHeight + 1) {
    return replyIndex === 0
  }
  return false
}
const _splitParse = (replyKey) => {
  const [height, index] = replyKey.split('_')
  return [parseInt(height), parseInt(index)]
}

export {
  ingestInterblocks,
  setAddress,
  txRequest,
  txReply,
  shiftTxRequest,
  invalidate,
}
