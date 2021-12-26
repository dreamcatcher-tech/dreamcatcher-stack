import assert from 'assert-fast'
import {
  Channel,
  Continuation,
  Action,
  Network,
  Interblock,
  Address,
  RxRequest,
  TxRequest,
  TxReply,
  Config,
  Conflux,
} from '../../w015-models'
import * as channelProducer from './channelProducer'
import Debug from 'debug'
const debug = Debug('interblock:producers:network')

/**
 * Interblocks cannot:
 *    1. cause any new channels to open, except the public connection one
 *    2. be destined for any channel that does not already exist
 *
 * Note that only one interblock can be accepted by the public channel,
 * and no others, until the block has finished.
 * Requisite that this funcion is called once per blockmaking, as it purges lineage
 */
const ingestInterblocks = (network, interblocks = [], config) => {
  assert(network instanceof Network)
  assert(Array.isArray(interblocks))
  assert(interblocks.every((v) => v instanceof Interblock))
  assert(config instanceof Config)

  const addressMap = _generateAddressMap(interblocks)
  const ingestedInterblocks = []
  for (const address of addressMap.keys()) {
    const channel = network.getByAddress(address)
    // TODO split handling opening public channel into seperate function call
    const isPublic = config.isPublicChannelOpen
    const channelInterblocks = addressMap.get(address)
    const firstInterblock = channelInterblocks[0]
    if (!channel && isPublic && firstInterblock.isConnectionAttempt()) {
      debug(`connection attempt accepted`)
      const name = `@@PUBLIC_${address.getChainId()}`
      const blankChannel = Channel.create(address)
      const accept = Action.create({ type: '@@ACCEPT' })
      const acceptChannel = blankChannel.update({
        requests: [accept],
      })
      network = network.set(name, acceptChannel)
    } else if (channel) {
      assert(channel instanceof Channel)
      const [nextChannel, ingested] = channelProducer.ingestInterblocks(
        channel,
        channelInterblocks
      )
      if (nextChannel !== channel) {
        network = network.setByAddress(address, nextChannel)
        ingestedInterblocks.push(...ingested)
      }
    }
  }

  return [network, new Conflux(ingestedInterblocks)]
  // TODO close all timed out connection attempts
}

const respondRejection = (network, request, reduceRejection) => {
  debug('respondRejection %O', reduceRejection)
  const reply = Continuation.create('@@REJECT', reduceRejection)
  return _respond(network, request, reply)
}

const respondRequest = (network, request) => {
  // no response has been given, and no throw, so respond with blank payload
  debug('respondRequest request: %o', request.type)
  const reply = Continuation.create('@@RESOLVE')
  return _respond(network, request, reply)
}

const _respond = (network, rxRequest, reply) => {
  assert(network instanceof Network)
  assert(rxRequest instanceof RxRequest)
  assert(reply instanceof Continuation)
  assert(!reply.isPromise())
  const address = rxRequest.getAddress()
  const channel = network.getByAddress(address)
  assert(channel instanceof Channel)
  assert(channel.address.deepEquals(address))
  const replyKey = rxRequest.getReplyKey()
  const existingReply = channel.replies[replyKey]
  assert(!existingReply || existingReply.isPromise())
  const { type, payload } = reply
  const txReply = TxReply.create(type, payload, rxRequest.identifier)
  const nextChannel = channelProducer.txReply(channel, txReply)
  assert(nextChannel.replies.get(replyKey))
  return network.setByAddress(address, nextChannel)
}

const tx = (network, txReplies = [], txRequests = []) => {
  assert(network instanceof Network)
  assert(Array.isArray(txReplies))
  assert(txReplies.every((v) => v instanceof TxReply))
  assert(Array.isArray(txRequests))
  assert(txRequests.every((v) => v instanceof TxRequest))

  debug(`txReplies: ${txReplies.length} txRequests: ${txRequests.length}`)
  for (const txRequest of txRequests) {
    let { to } = txRequest
    if (network.get('..').address.isRoot() && to.startsWith('/')) {
      to = to.substring(1)
      to = to || '.'
    }
    // TODO detect child construction by the path, so ensure role is correct
    let channel = network.get(to)
    if (!channel) {
      // TODO handle children ?  if no pathing or starts with ./ ?
      // TODO maybe do path opening here, working backwards
      const systemRole = to === '.@@io' ? 'PIERCE' : 'DOWN_LINK'
      const address = Address.create()
      channel = Channel.create(address, systemRole)
      debug(`channel created with systemRole: ${systemRole}`)
    }
    channel = channelProducer.txRequest(channel, txRequest.getRequest())
    network = network.set(to, channel)
  }
  for (const txReply of txReplies) {
    const address = txReply.getAddress()
    if (!network.hasByAddress(address)) {
      continue
    }
    let channel = network.getByAddress(address)
    channel = channelProducer.txReply(channel, txReply)
    network = network.setByAddress(address, channel)
  }
  return network
}

const invalidateLocal = (network) => {
  // TODO rename to unopenable path
  const aliases = network.getUnresolvedAliases()
  for (const alias of aliases) {
    if (alias === '.@@io') {
      continue
    }
    const isLocal = !alias.includes('/')
    const channel = network.get(alias)
    if (isLocal && channel.address.isUnknown()) {
      network = network.set(alias, channelProducer.invalidate(channel))
    }
  }
  return network
}
const reaper = (network) => {
  // TODO also handle timed out channels here - idle clogs system
  const aliases = network.getUnresolvedAliases()
  for (const alias of aliases) {
    const channel = network.get(alias)
    if (channel.address.isInvalid()) {
      assert(!channel.tip)
      network = network.remove(alias)
    }
  }
  return network
}
const _generateAddressMap = (interblocks) => {
  const chainMap = new Map()
  for (const interblock of interblocks) {
    const address = interblock.provenance.getAddress()
    if (!chainMap.get(address)) {
      chainMap.set(address, [])
    }
    const channelInterblocks = chainMap.get(address)
    channelInterblocks.push(interblock)
    channelInterblocks.sort((a, b) => a.provenance.height - b.provenance.height)
  }
  return chainMap
}
const zeroTransmissions = (network, precedent) => {
  assert(network instanceof Network)
  const aliases = network.getTransmittingAliases()
  const nextNetwork = {}
  for (const alias of aliases) {
    const channel = network.get(alias)
    assert(channel.isTransmitting())
    const nextChannel = channelProducer.zeroTransmissions(channel, precedent)
    nextNetwork[alias] = nextChannel
  }
  network = network.setMany(nextNetwork)
  return network
}
export {
  ingestInterblocks,
  respondRejection,
  respondRequest,
  tx,
  invalidateLocal,
  reaper,
  zeroTransmissions,
}
