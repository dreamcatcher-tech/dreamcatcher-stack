import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:producers:channel')
import {
  addressModel,
  channelModel,
  interblockModel,
  actionModel,
  txReplyModel,
  rxReplyModel,
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

// entry point for covenant into system
const txRequest = (channel, action) => {
  debug('txRequest')
  assert(actionModel.isModel(action), `must supply request object`)
  // TODO decide if should allow actions to initiate channels just by asking to talk to them
  // TODO use immutable map to detect duplicates faster
  let { requests } = channel
  requests = [...requests, action]
  return channelModel.clone({ ...channel, requests })
}

// entry point for covenant into system
const txReply = (channel, txReply) => {
  assert(channelModel.isModel(channel))
  assert(txReplyModel.isModel(txReply), `must supply reply object`)
  // TODO track txPromises so dev reducer cannot misbehave
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

const shiftLoopbackSettle = (loopback) => {
  const rxReply = loopback.rxLoopbackSettle()
  assert(rxReplyModel.isModel(rxReply))
  let { rxPromises = [], ...rest } = loopback

  const key = `${rxReply.getHeight()}_${rxReply.getIndex()}`
  assert(rxPromises.includes(key))
  rxPromises = rxPromises.filter((promisedKey) => promisedKey !== key)
  if (rxPromises.length) {
    rest.rxPromises = rxPromises
  }
  return channelModel.clone(rest)
}

const shiftLoopbackReply = (loopback) => {
  assert(channelModel.isModel(loopback))
  assert(loopback.isLoopback())
  const nextLoopback = { ...loopback }
  let { replies, rxPromises = [], rxRepliesTip, tipHeight } = loopback
  if (!loopback.isLoopbackReplyPromised()) {
    const rxReply = loopback.rxLoopbackReply()
    assert(rxReplyModel.isModel(rxReply), `Must be a reply`)
  }

  const currentHeight = Number.isInteger(tipHeight) ? tipHeight + 1 : 0
  const [rxHeight, rxIndex] = splitRxRepliesTip(rxRepliesTip)
  assert(rxHeight <= currentHeight)
  // need to test that the current rxRepliesTip points to a reply, not a request
  if (rxHeight === currentHeight) {
    rxRepliesTip = `${rxHeight}_${rxIndex + 1}`
  } else {
    rxRepliesTip = `${currentHeight}_${0}`
  }
  nextLoopback.rxRepliesTip = rxRepliesTip

  if (loopback.isLoopbackReplyPromised()) {
    const promise = replies[rxRepliesTip]
    assert.strictEqual(promise.type, '@@PROMISE')
    rxPromises.push(rxRepliesTip)
    nextLoopback.rxPromises = rxPromises
  }

  return channelModel.clone(nextLoopback)
  // TODO at the end of reduction, we want the loopback channel completely empty
  // update tipheight so we always start afresh every cycle
}
const splitRxRepliesTip = (rxRepliesTip) => {
  if (!rxRepliesTip) {
    return [-1, -1]
  }
  assert.strictEqual(typeof rxRepliesTip, 'string')
  const [sHeight, sIndex] = rxRepliesTip.split('_')
  const height = Number.parseInt(sHeight)
  const index = Number.parseInt(sIndex)
  assert(height >= 0)
  assert(index >= 0)
  return [height, index]
}
const zeroLoopback = (channel) => {
  // always increments the tipHeight by one
  assert(channelModel.isModel(channel))
  assert(channel.isLoopback())
  assert(!channel.rxLoopback(), `Loopback not drained`)
  const tipHeight = Number.isInteger(channel.tipHeight) ? tipHeight + 1 : 0
  return channelModel.clone({
    ...channel,
    requests: [],
    replies: {},
    tipHeight,
  })
}

export {
  ingestInterblocks,
  setAddress,
  txRequest,
  txReply,
  invalidate,
  shiftLoopbackSettle,
  shiftLoopbackReply,
  zeroLoopback,
}
