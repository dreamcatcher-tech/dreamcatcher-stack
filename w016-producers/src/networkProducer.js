const assert = require('assert')
const debug = require('debug')('interblock:producers:network')
const _ = require('lodash')
const {
  channelModel,
  continuationModel,
  actionModel,
  networkModel,
  stateModel,
  interblockModel,
  addressModel,
  rxRequestModel,
  txRequestModel,
  txReplyModel,
  configModel,
} = require('../../w015-models')
const channelProducer = require('./channelProducer')

const defaultConfig = configModel.create()
const ingestInterblocks = (network, interblocks = [], config = defaultConfig) =>
  networkModel.clone(network, (draft) => {
    // implicit that this is called once per blockmaking, as it purges lineage
    interblocks = _cloneArray(interblocks, interblockModel.clone)
    assert(configModel.isModel(config))
    debug(`ingestInterblocks count: ${interblocks.length}`)
    interblocks.sort((a, b) => a.provenance.height - b.provenance.height)
    let nextNetwork = network // DANGER draft demodelizes

    interblocks.forEach((interblock) => {
      const address = interblock.provenance.getAddress()
      // TODO handle multiple aliases having the same address ?
      const alias = _getAlias(nextNetwork, address)
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
        const newChannel = { [name]: acceptChannel }

        nextNetwork = { ...nextNetwork, ...newChannel }
      }
      if (alias) {
        let channel = nextNetwork[alias]
        channel = channelProducer.ingestInterblock(channel, interblock)
        if (interblock.isConnectionResponse()) {
          // TODO assertion tests on state of channel
        }
        if (!channel.heavy) {
          return
        }
        nextNetwork = { ...nextNetwork, [alias]: channel }
      }
    })
    // TODO purge all channels of lineage
    Object.keys(nextNetwork).forEach((alias) => {
      // trim lineageTip to only the last one from the previous block
      const originalChannel = network[alias]
      let channel = nextNetwork[alias]
      if (!originalChannel || !channel.address.isResolved() || !channel.heavy) {
        return
      }
      const purgeableTips = originalChannel.lineageTip.slice(0, -1)
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
      nextNetwork = { ...nextNetwork, [alias]: channel }
    })

    // TODO close all timed out connection attempts
    // TODO speed up immer by using draft instead of new object ?
    return nextNetwork
  })

const _getAlias = (network, address) => {
  // speed up by not cloning network each interblock
  assert(addressModel.isModel(address))
  assert(!address.isUnknown())
  const alias = Object.keys(network).find((key) =>
    network[key].address.equals(address)
  )
  return alias
}

const respondReply = (network, address) =>
  networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    const alias = network.getAlias(address)
    debug(`respondReply alias: ${alias}`)

    const channel = network[alias]
    const reply = channel.rxReply()
    assert(reply)
    // TODO WRONG must use the sequence of the reply, which might be a promise
    const nextChannel = channelProducer.shiftTxRequest(channel)
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

const tx = (network, state) =>
  networkModel.clone(network, (draft) => {
    assert(networkModel.isModel(network))
    assert(stateModel.isModel(state))
    const requests = state.getRequests()
    const replies = state.getReplies()
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
        const systemRole = 'SYMLINK'
        const address = addressModel.create(systemRole)
        debug(`channel created with systemRole: ${systemRole}`)
        channel = channelModel.create(address, systemRole)
      }
      immerNetwork[to] = channelProducer.txRequest(channel, request.getAction())
    })
    replies.forEach((reply) => {
      assert(txReplyModel.isModel(reply))
      const address = reply.getAddress()
      const index = reply.getIndex()
      const alias = network.getAlias(address)
      if (!alias) {
        debug(`No alias found for: %O`, reply)
        return
      }
      const channel = immerNetwork[alias] || network[alias]
      const continuation = reply.getContinuation()
      immerNetwork[alias] = channelProducer.txReply(
        channel,
        continuation,
        index
      )
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
