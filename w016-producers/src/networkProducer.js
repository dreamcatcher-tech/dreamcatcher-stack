const assert = require('assert')
const posix = require('path')
const debug = require('debug')('interblock:producers:network')
const _ = require('lodash')
const {
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
} = require('../../w015-models')
const channelProducer = require('./channelProducer')

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
  interblocks = _cloneArray(interblocks, interblockModel.clone) // TODO remove ?
  assert(configModel.isModel(config))

  const perChain = displaceLightWithHeavy(interblocks)
  const nextNetwork = {} // draft causes failure to model check
  for (const address of perChain.keys()) {
    const alias = network.getAlias(address)
    // TODO split handling opening public channel into seperate function call
    const isPublic = config.isPublicChannelOpen
    const interblocks = [...perChain.get(address).values()]
    const firstInterblock = interblocks[0]
    if (!alias && isPublic && firstInterblock.isConnectionAttempt()) {
      debug(`connection attempt accepted`)
      const name = `@@PUBLIC_${address.getChainId()}`
      const blankChannel = channelModel.create(address)
      const accept = actionModel.create({ type: '@@ACCEPT' })
      const acceptChannel = channelModel.clone({
        ...blankChannel,
        requests: { 0: accept },
      })
      nextNetwork[name] = acceptChannel
    }
    if (alias) {
      let channel = nextNetwork[alias] || network[alias]
      assert(channelModel.isModel(channel))
      channel = channelProducer.ingestInterblocks(channel, interblocks)
      if (firstInterblock.isConnectionResponse()) {
        // TODO assertion tests on state of channel - can be any of the interblocks in the array ?
      }
      if (!channel.heavy || channel.equals(network[alias])) {
        continue
      }
      nextNetwork[alias] = channel
    }
  }

  network.getAliases().forEach((alias) => {
    // trim lineageTip to only the last one from the previous block
    const original = network[alias]
    if (!original || !original.address.isResolved() || !original.heavy) {
      return
    }
    let channel = nextNetwork[alias] || original

    const purgeableTips = original.lineageTip.slice(0, -1)
    const lineageTip = _.without(channel.lineageTip, ...purgeableTips)

    // trim lineage to start with heavy, or lineageTip
    const heavyIndex = channel.lineage.findIndex((integrity) =>
      integrity.equals(channel.heavy.provenance.reflectIntegrity())
    )
    const lineageTipIndex = channel.lineage.findIndex((integrity) =>
      integrity.equals(lineageTip[0].provenance.reflectIntegrity())
    )
    const minIndex = heavyIndex < lineageTipIndex ? heavyIndex : lineageTipIndex
    assert(minIndex >= 0, `minIndex out of bounds`)
    const lineage = channel.lineage.slice(minIndex)
    // TODO try avoid clone and do purge at same time as ingest
    channel = channelModel.clone({ ...channel, lineage, lineageTip })
    if (!channel.equals(original)) {
      nextNetwork[alias] = channel
    }
  })
  return networkModel.merge(network, nextNetwork)
  // TODO close all timed out connection attempts
}

const respondReply = (network, address, originalLoopback) => {
  assert(addressModel.isModel(address))
  assert(channelModel.isModel(originalLoopback))
  const alias = network.getAlias(address)
  debug(`respondReply alias: ${alias}`)

  const channel = network[alias]
  const nextChannel = channelProducer.shiftTxRequest(channel, originalLoopback)
  return networkModel.merge(network, { [alias]: nextChannel })
}

const respondRejection = (network, request, reduceRejection) => {
  debug('respondRejection %O', reduceRejection)
  const reply = continuationModel.create('@@REJECT', reduceRejection)
  return _respond(network, request, reply)
}

const respondRequest = (network, request) => {
  // no response has been given, and no throw, so respond with null payload
  debug('respondRequest request: %o', request.type)
  const reply = continuationModel.create('@@RESOLVE')
  return _respond(network, request, reply)
}

const _respond = (network, request, reply) => {
  assert(rxRequestModel.isModel(request))
  assert(continuationModel.isModel(reply))
  const address = request.getAddress()
  const alias = network.getAlias(address)
  const channel = network[alias]
  assert(channelModel.isModel(channel))
  assert(channel.address.equals(address))
  assert(channel.rxRequest().equals(request))
  const index = request.getIndex()
  assert(!channel.replies[index])
  let nextChannel = channelProducer.txReply(channel, reply)
  assert(nextChannel.replies[index])
  return networkModel.merge(network, { [alias]: nextChannel })
}

const tx = (network, requests, replies) => {
  assert(networkModel.isModel(network))
  assert(Array.isArray(requests))
  assert(Array.isArray(replies))

  debug(`tx requests: ${requests.length} replies: ${replies.length}`)
  const nextNetwork = {} // immer breaks isModel test
  requests.forEach((request) => {
    assert(txRequestModel.isModel(request))
    let { to } = request
    to = posix.normalize(to)
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
    nextNetwork[to] = channelProducer.txRequest(channel, request.getRequest())
  })
  replies.forEach((txReply) => {
    assert(txReplyModel.isModel(txReply))
    const address = txReply.getAddress()
    const index = txReply.getIndex()
    const alias = network.getAlias(address)
    if (!alias) {
      debug(`No alias found for: %O`, txReply)
      return
    }
    const channel = nextNetwork[alias] || network[alias]
    const reply = txReply.getReply()
    nextNetwork[alias] = channelProducer.txReply(channel, reply, index)
  })
  return networkModel.merge(network, nextNetwork)
}

const _cloneArray = (toBeArray, cloneFunction) => {
  if (!Array.isArray(toBeArray)) {
    toBeArray = [toBeArray]
  }
  return toBeArray.map(cloneFunction)
}
const invalidateLocal = (network) => {
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
  return networkModel.merge(network, nextNetwork)
}
const reaper = (network) =>
  networkModel.clone(network, (draft) => {
    // TODO also handle timed out channels here - idle clogs system
    const aliases = network.getAliases()
    let nextNetwork
    let isDeleted = false
    for (const alias of aliases) {
      const channel = network[alias]
      if (channel.address.isInvalid()) {
        assert(!channel.rxRequest())
        if (!channel.rxReply()) {
          isDeleted = true
          if (!nextNetwork) {
            nextNetwork = { ...network }
          }
          delete nextNetwork[alias]
        }
      }
    }
    if (isDeleted) {
      return networkModel.clone(nextNetwork)
    }
    return network
  })
const displaceLightWithHeavy = (interblocks) => {
  // TODO remove this function when remotechains is implemented
  const perChain = new Map()
  interblocks.forEach((interblock) => {
    const address = interblock.provenance.getAddress()
    if (!perChain.get(address)) {
      perChain.set(address, new Map())
    }
    const displaced = perChain.get(address)
    const height = interblock.provenance.height
    if (displaced.has(height)) {
      if (interblock.getOriginAlias()) {
        displaced.set(height, interblock)
      }
    } else {
      displaced.set(height, interblock)
    }
  })
  return perChain
}
module.exports = {
  ingestInterblocks,
  respondRejection,
  respondRequest,
  respondReply,
  tx,
  invalidateLocal,
  reaper,
}
