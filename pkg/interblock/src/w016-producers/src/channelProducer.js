import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:producers:channel')
import {
  Address,
  Channel,
  Interblock,
  Action,
  TxReply,
  RxReply,
  Integrity,
} from '../../w015-models'

const ingestInterblocks = (channel, interblocks) => {
  assert(channel instanceof Channel)
  assert(Array.isArray(interblocks))
  assert(interblocks.every((v) => v instanceof Interblock))
  interblocks = [...interblocks]
  interblocks.sort((a, b) => a.provenance.height - b.provenance.height)
  // TODO check they are consecutive ?
  // TODO check the precedents match correctly ?

  const ingested = []
  for (const interblock of interblocks) {
    const currentChannel = channel
    channel = _ingestInterblock(channel, interblock)
    if (channel === currentChannel) {
      debug(`interblock not ingested`)
      break
    }
    ingested.push(interblock)
  }
  return [channel, ingested]
}

const _ingestInterblock = (channel, interblock) => {
  // TODO count all inbound promises
  // TODO verify interblock replies are increasing
  // TODO do some logic on the channel counts, and if they match ours ?
  // check this transmission naturally extends the remote transmission ?
  // handle validator change in lineage
  debug('ingestInterblock')
  assert(interblock instanceof Interblock)
  assert(channel.address.deepEquals(interblock.provenance.getAddress()))
  const { provenance, turnovers } = interblock
  const integrity = provenance.reflectIntegrity()
  const { transmission } = interblock

  let { rxRepliesTip, tip, tipHeight } = channel
  assert(_rxRepliesTipHeight(rxRepliesTip) <= provenance.height)

  if (tip && !transmission.precedent.equals(tip)) {
    return channel
  }
  if (transmission.precedent.isUnknown()) {
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
      assert(genesis.provenance.getAddress().deepEquals(channel.address))
      // TODO handle validators changing at any point
    }
  }
  rxRepliesTip = _getRxRepliesTip(rxRepliesTip, transmission.replies)
  tip = integrity
  tipHeight = provenance.height
  const update = { tip, tipHeight }
  if (rxRepliesTip) {
    update.rxRepliesTip = rxRepliesTip
  }
  channel = channel.update(update)
  return channel
}
const _getRxRepliesTip = (rxRepliesTip, replies) => {
  const keys = Object.keys(replies)
  if (!keys.length) {
    return rxRepliesTip
  }
  const parse = (key) => {
    if (!key) {
      return [-1, -1]
    }
    const [sHeight, sIndex] = key.split('_')
    const height = parseInt(sHeight)
    const index = parseInt(sIndex)
    return [height, index]
  }
  // TODO check that they increment on rxRepliesTip
  // OR that they settle an rxPromise
  // AND log any promises into rxPromises
  let [mHeight, mIndex] = parse(rxRepliesTip)
  for (const key of keys) {
    const [height, index] = parse(key)
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
  assert(channel instanceof Channel)
  assert(address instanceof Address)
  assert(!address.isGenesis())
  if (channel.address.deepEquals(address)) {
    return channel
  }
  // TODO if changing address, flush all channels
  return channel.update({ address })
}

// entry point for covenant into system
const txRequest = (channel, action) => {
  assert(channel instanceof Channel)
  assert(action instanceof Action, `must supply request object`)
  debug('txRequest')
  // TODO decide if should allow actions to initiate channels just by asking to talk to them
  // TODO use immutable map to detect duplicates faster
  let { requests } = channel
  requests = [...requests, action]
  return channel.update({ requests })
}

// entry point for covenant into system
const txReply = (channel, txReply) => {
  assert(channel instanceof Channel)
  assert(txReply instanceof TxReply, `must supply reply object`)
  // TODO track txPromises so dev reducer cannot misbehave
  const replyKey = txReply.getReplyKey()
  let { replies } = channel
  if (replies.has(replyKey)) {
    assert.strictEqual(replies.get(replyKey).type, '@@PROMISE')
  }

  const existingReply = replies.get(replyKey)
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
  const isLoopbackPromise =
    // TODO WARNING need to store txPromises so this works for others channels too
    channel.address.isLoopback() &&
    channel.rxPromises &&
    channel.rxPromises.includes(replyKey)
  if (!existingReply && !isTip && !isLoopbackPromise) {
    throw new Error(`Can only settle synchronously with tip: ${replyKey}`)
  }
  replies = { ...replies, [replyKey]: reply }
  return channel.update({ replies })
}
const invalidate = (channel) => {
  const invalid = Address.create('INVALID')
  return setAddress(channel, invalid)
}

// exit point from system to covenant

const _isTip = (replyKey, replies) => {
  assert.strictEqual(typeof replyKey, 'string')
  assert.strictEqual(typeof replies, 'object')
  if (!replies.size) {
    return true
  }
  let maxHeight, maxIndex
  for (const [key, value] of replies.entries()) {
    const [height, index] = _splitParse(key)
    if (maxHeight === undefined) {
      maxHeight = height
      maxIndex = index
    }
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
  assert(rxReply instanceof RxReply)
  let { rxPromises = [] } = loopback
  const key = `${rxReply.getHeight()}_${rxReply.getIndex()}`
  assert(rxPromises.includes(key))
  rxPromises = rxPromises.filter((promisedKey) => promisedKey !== key)
  if (rxPromises.length) {
    return loopback.update({ rxPromises })
  }
  return loopback.delete('rxPromises')
}

const shiftLoopbackReply = (loopback) => {
  assert(loopback instanceof Channel)
  assert(loopback.isLoopback())
  let { replies, rxPromises = [], rxRepliesTip, tipHeight } = loopback
  if (!loopback.isLoopbackReplyPromised()) {
    const rxReply = loopback.rxLoopbackReply()
    assert(rxReply instanceof RxReply, `Must be a reply`)
  }

  const currentHeight = Number.isInteger(tipHeight) ? tipHeight + 1 : 1
  const [rxHeight, rxIndex] = splitRxRepliesTip(rxRepliesTip)
  assert(rxHeight <= currentHeight)
  if (rxHeight === currentHeight) {
    rxRepliesTip = `${rxHeight}_${rxIndex + 1}`
  } else {
    rxRepliesTip = `${currentHeight}_${0}`
  }
  let nextLoopback = loopback.update({ rxRepliesTip })
  if (loopback.isLoopbackReplyPromised()) {
    const promise = replies.get(rxRepliesTip)
    assert.strictEqual(promise.type, '@@PROMISE')
    rxPromises = [...rxPromises, rxRepliesTip]
    nextLoopback = nextLoopback.update({ rxPromises })
  }
  return nextLoopback
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
  assert(channel instanceof Channel)
  assert(channel.isLoopback())
  assert(!channel.rxLoopback(), `Loopback not drained`)
  // current height can never be zero, as isolation cannot occur for block 0
  let tipHeight = 1
  if (Number.isInteger(channel.tipHeight)) {
    tipHeight = channel.tipHeight + 1
  }
  const replies = channel.replies.clear()
  return channel.update({ requests: [], replies, tipHeight })
}
const zeroTransmissions = (channel, precedent) => {
  assert(channel instanceof Channel)
  assert(precedent instanceof Integrity)
  if (!channel.isTransmitting()) {
    return channel
  }
  return channel.update({ replies: {}, requests: [], precedent })
}
const shiftLoopback = (loopback) => {
  assert(loopback instanceof Channel)
  assert(loopback.isLoopback())
  assert(!loopback.isLoopbackExhausted())
  if (loopback.rxLoopbackSettle()) {
    return shiftLoopbackSettle(loopback)
  }
  if (loopback.isLoopbackReplyPromised() || loopback.rxLoopbackReply()) {
    return shiftLoopbackReply(loopback)
  }
  throw new Error(`shift only applies to settles, replies, and promises`)
}

export {
  ingestInterblocks,
  setAddress,
  txRequest,
  txReply,
  invalidate,
  shiftLoopbackSettle,
  shiftLoopbackReply,
  shiftLoopback,
  zeroLoopback,
  zeroTransmissions,
}
