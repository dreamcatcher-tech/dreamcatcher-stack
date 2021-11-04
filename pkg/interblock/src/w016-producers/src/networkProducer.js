import assert from 'assert-fast'
import {
  channelModel,
  continuationModel,
  actionModel,
  networkModel,
  interblockModel,
  addressModel,
  rxRequestModel,
  txRequestModel,
  txReplyModel,
  configModel,
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
  assert(networkModel.isModel(network))
  assert(Array.isArray(interblocks))
  assert(interblocks.every(interblockModel.isModel))
  assert(configModel.isModel(config))

  const addressMap = _generateAddressMap(interblocks)
  const nextNetwork = {}
  const ingestedInterblocks = []
  for (const address of addressMap.keys()) {
    const alias = network.getAlias(address)
    // TODO split handling opening public channel into seperate function call
    const isPublic = config.isPublicChannelOpen
    const channelInterblocks = addressMap.get(address)
    const firstInterblock = channelInterblocks[0]
    if (!alias && isPublic && firstInterblock.isConnectionAttempt()) {
      debug(`connection attempt accepted`)
      const name = `@@PUBLIC_${address.getChainId()}`
      const blankChannel = channelModel.create(address)
      const accept = actionModel.create({ type: '@@ACCEPT' })
      const acceptChannel = channelModel.clone({
        ...blankChannel,
        requests: [accept],
      })
      nextNetwork[name] = acceptChannel
    } else if (alias) {
      let channel = nextNetwork[alias] || network[alias]
      assert(channelModel.isModel(channel))
      const [nextChannel, ingested] = channelProducer.ingestInterblocks(
        channel,
        channelInterblocks
      )
      channel = nextChannel
      ingestedInterblocks.push(...ingested)
      nextNetwork[alias] = channel
    }
  }

  return [network.merge(nextNetwork), new Conflux(ingestedInterblocks)]
  // TODO close all timed out connection attempts
}

const respondRejection = (network, request, reduceRejection) => {
  debug('respondRejection %O', reduceRejection)
  const reply = continuationModel.create('@@REJECT', reduceRejection)
  return _respond(network, request, reply)
}

const respondRequest = (network, request) => {
  // no response has been given, and no throw, so respond with blank payload
  debug('respondRequest request: %o', request.type)
  const reply = continuationModel.create('@@RESOLVE')
  return _respond(network, request, reply)
}

const _respond = (network, rxRequest, reply) => {
  assert(rxRequestModel.isModel(rxRequest))
  assert(continuationModel.isModel(reply))
  assert(!reply.isPromise())
  const address = rxRequest.getAddress()
  const alias = network.getAlias(address)
  const channel = network[alias]
  assert(channelModel.isModel(channel))
  assert(channel.address.equals(address))
  const replyKey = rxRequest.getReplyKey()
  const existingReply = channel.replies[replyKey]
  assert(!existingReply || existingReply.isPromise())
  const { type, payload } = reply
  const txReply = txReplyModel.create(type, payload, rxRequest.identifier)
  const nextChannel = channelProducer.txReply(channel, txReply)
  assert(nextChannel.replies[replyKey])
  return network.merge({ [alias]: nextChannel })
}

const tx = (network, transmissions) => {
  assert(networkModel.isModel(network))
  assert(Array.isArray(transmissions))
  const requests = transmissions.filter(txRequestModel.isModel)
  const replies = transmissions.filter(txReplyModel.isModel)
  assert.strictEqual(transmissions.length, requests.length + replies.length)

  debug(`tx requests: ${requests.length} replies: ${replies.length}`)
  const nextNetwork = {}
  for (const txRequest of requests) {
    let { to } = txRequest
    if (network['..'].address.isRoot() && to.startsWith('/')) {
      to = to.substring(1)
      to = to || '.'
    }
    // TODO detect child construction by the path, so ensure role is correct
    let channel = nextNetwork[to] || network[to]
    if (!channel) {
      // TODO handle children ?  if no pathing or starts with ./ ?
      // TODO maybe do path opening here, working backwards
      const systemRole = to === '.@@io' ? 'PIERCE' : 'DOWN_LINK'
      const address = addressModel.create()
      channel = channelModel.create(address, systemRole)
      debug(`channel created with systemRole: ${systemRole}`)
    }
    nextNetwork[to] = channelProducer.txRequest(channel, txRequest.getRequest())
  }
  for (const txReply of replies) {
    const address = txReply.getAddress()
    const alias = network.getAlias(address)
    if (!alias) {
      debug(`No alias found for: %O`, txReply)
      return
    }
    const channel = nextNetwork[alias] || network[alias]
    nextNetwork[alias] = channelProducer.txReply(channel, txReply)
  }
  return network.merge(nextNetwork)
}

const invalidateLocal = (network) => {
  // TODO what is this even for ?
  // supposed to be for detecting when openPaths has stalled
  // but openPaths should do this work itself ?
  const nextNetwork = {}
  const aliases = network.getAliases()
  for (const alias of aliases) {
    if (alias === '.@@io') {
      continue
    }
    const isLocal = !alias.includes('/')
    if (isLocal && network[alias].address.isUnknown()) {
      nextNetwork[alias] = channelProducer.invalidate(network[alias])
    }
  }
  return network.merge(nextNetwork)
}
const reaper = (network) => {
  // TODO also handle timed out channels here - idle clogs system
  const aliases = network.getAliases()
  let nextNetwork
  for (const alias of aliases) {
    const channel = network[alias]
    if (channel.address.isInvalid()) {
      assert(!channel.tip)
      if (!nextNetwork) {
        nextNetwork = { ...network }
      }
      delete nextNetwork[alias]
    }
  }
  if (nextNetwork) {
    return networkModel.clone(nextNetwork)
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
  assert(networkModel.isModel(network))
  const nextNetwork = {}
  const aliases = network.getAliases()
  for (const alias of aliases) {
    const channel = network[alias]
    const nextChannel = channelProducer.zeroTransmissions(channel, precedent)
    nextNetwork[alias] = nextChannel
  }
  return network.merge(nextNetwork)
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
