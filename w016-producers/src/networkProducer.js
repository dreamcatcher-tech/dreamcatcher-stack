const assert = require('assert')
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
 */
const ingestInterblocks = (network, interblocks = [], config) =>
  networkModel.clone(network, (draft) => {
    // implicit that this is called once per blockmaking, as it purges lineage
    interblocks = _cloneArray(interblocks, interblockModel.clone)
    assert(configModel.isModel(config))
    debug(`ingestInterblocks count: ${interblocks.length}`)
    interblocks.sort((a, b) => a.provenance.height - b.provenance.height)

    const immerNetwork = {} // draft causes failure to model check
    interblocks.forEach((interblock) => {
      const address = interblock.provenance.getAddress()
      // TODO handle multiple aliases having the same address ?
      const alias = network.getAlias(address)
      // TODO split handling opening public channel into seperate function call
      const isPublic = config.isPublicChannelOpen
      if (!alias && isPublic && interblock.isConnectionAttempt()) {
        debug(`connection attempt accepted`)
        const name = `@@PUBLIC_${address.getChainId()}`
        const blankChannel = channelModel.create(address)
        const accept = actionModel.create({ type: '@@ACCEPT' })
        const acceptChannel = channelModel.clone({
          ...blankChannel,
          requests: { 0: accept },
        })
        draft[name] = acceptChannel
      }
      if (alias) {
        let channel = immerNetwork[alias] || network[alias]
        assert(channelModel.isModel(channel))
        channel = channelProducer.ingestInterblock(channel, interblock)
        if (interblock.isConnectionResponse()) {
          // TODO assertion tests on state of channel
        }
        if (!channel.heavy || channel.equals(network[alias])) {
          return
        }
        immerNetwork[alias] = channel
      }
    })
    network.getAliases().forEach((alias) => {
      // trim lineageTip to only the last one from the previous block
      const original = network[alias]
      if (!original || !original.address.isResolved() || !original.heavy) {
        return
      }
      let channel = immerNetwork[alias] || original

      const purgeableTips = original.lineageTip.slice(0, -1)
      const lineageTip = _.without(channel.lineageTip, ...purgeableTips)

      // trim lineage to start with heavy, or lineageTip
      const heavyIndex = channel.lineage.findIndex((integrity) =>
        integrity.equals(channel.heavy.provenance.reflectIntegrity())
      )
      const lineageTipIndex = channel.lineage.findIndex((integrity) =>
        integrity.equals(lineageTip[0].provenance.reflectIntegrity())
      )
      const minIndex =
        heavyIndex < lineageTipIndex ? heavyIndex : lineageTipIndex
      assert(minIndex >= 0, `minIndex out of bounds`)
      const lineage = channel.lineage.slice(minIndex)
      channel = channelModel.clone({ ...channel, lineage, lineageTip })
      if (!channel.equals(original)) {
        immerNetwork[alias] = channel
      }
    })
    Object.keys(immerNetwork).forEach((key) => (draft[key] = immerNetwork[key]))

    // TODO close all timed out connection attempts
  })
const respondReply = (network, address, originalLoopback) =>
  networkModel.clone(network, (draft) => {
    assert(addressModel.isModel(address))
    assert(channelModel.isModel(originalLoopback))
    const alias = network.getAlias(address)
    debug(`respondReply alias: ${alias}`)

    const channel = network[alias]
    const nextChannel = channelProducer.shiftTxRequest(
      channel,
      originalLoopback
    )
    draft[alias] = nextChannel
  })

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

const _respond = (network, request, reply) =>
  networkModel.clone(network, (draft) => {
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
    draft[alias] = nextChannel
  })

const tx = (network, requests, replies) =>
  networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    assert(Array.isArray(requests))
    assert(Array.isArray(replies))

    debug(`tx requests: ${requests.length} replies: ${replies.length}`)
    const immerNetwork = {} // immer breaks isModel test
    requests.forEach((request) => {
      assert(txRequestModel.isModel(request))
      const { to } = request
      // TODO resolve the "to" alias name to rationalize it
      // TODO detect child construction by the path, so ensure role is correct
      let channel = immerNetwork[to] || network[to]
      if (!channel) {
        // TODO handle children ?  if no pathing or starts with ./ ?
        // TODO maybe do path opening here, working backwards
        const systemRole = to === '.@@io' ? 'PIERCE' : 'DOWN_LINK'
        const address = addressModel.create()
        channel = channelModel.create(address, systemRole)
        debug(`channel created with systemRole: ${systemRole}`)
      }
      immerNetwork[to] = channelProducer.txRequest(
        channel,
        request.getRequest()
      )
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
      const channel = immerNetwork[alias] || network[alias]
      const reply = txReply.getReply()
      immerNetwork[alias] = channelProducer.txReply(channel, reply, index)
    })
    Object.keys(immerNetwork).forEach((key) => (draft[key] = immerNetwork[key]))
  })

const _cloneArray = (toBeArray, cloneFunction) => {
  if (!Array.isArray(toBeArray)) {
    toBeArray = [toBeArray]
  }
  return toBeArray.map(cloneFunction)
}

module.exports = {
  ingestInterblocks,
  respondRejection,
  respondRequest,
  respondReply,
  tx,
}
