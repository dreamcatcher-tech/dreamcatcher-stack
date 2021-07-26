const assert = require('assert')
const debug = require('debug')('interblock:models:channel')
const last = require('lodash/last')
const { rxRequestModel, rxReplyModel } = require('../transients')
const { standardize } = require('../modelUtils')
const { addressModel } = require('./addressModel')
const { actionModel } = require('./actionModel')
const { continuationModel } = require('./continuationModel')
const { remoteModel } = require('./remoteModel')
const { channelSchema } = require('../schemas/modelSchemas')
const { reject } = require('../../../w002-api')

const channelModel = standardize({
  schema: channelSchema,
  create(address, systemRole = 'DOWN_LINK') {
    // TODO calculate systemRole from alias
    address = addressModel.clone(address)
    const remote = remoteModel.create({ address })
    const channel = {
      ...remote,
      systemRole,
      requestsLength: 0,
      lineage: [],
      lineageTip: [],
    }
    return channelModel.clone(channel)
  },
  logicize(instance) {
    // TODO check the provenance chain
    // TODO if reset address, must clear all remote requests, else promises break
    // TODO check no duplicate requests in channel - must be distiguishable
    const {
      address,
      systemRole,
      requests,
      replies,
      heavy,
      lineageHeight,
      heavyHeight,
      lineage,
      lineageTip, // TODO test lineage integrity
      requestsLength,
    } = instance
    const isLoopback = systemRole === '.'

    if (address.isUnknown()) {
      assert.strictEqual(Object.keys(replies).length, 0)
    }
    // TODO if this is pierce channel, ensure only requests are OOB effects ?
    const remote = isLoopback
      ? remoteModel.create(instance)
      : heavy && heavy.getRemote()
      ? heavy.getRemote()
      : remoteModel.create()
    assert(remote)
    if (isLoopback) {
      assert(address.isLoopback())
      const banned = ['@@OPEN_CHILD']
      const outs = Object.values(requests)
      const ins = Object.values(remote.requests)
      assert(outs.every(({ type }) => !banned.includes(type)))
      assert(ins.every(({ type }) => !banned.includes(type)))
    }
    if (heavy) {
      assert(heavy.getRemote() || heavyHeight === 0)
      assert.strictEqual(heavy.provenance.height, heavyHeight)
      assert(lineageHeight >= heavyHeight)
    }
    if (lineageTip.length) {
      const { provenance } = last(lineageTip)
      assert.strictEqual(provenance.height, lineageHeight)
      assert(last(lineage).equals(provenance.reflectIntegrity()))
    }

    assert(lineageTip.every((interblock) => !interblock.getRemote()))
    _checkAllInts(requests)
    _checkAllInts(replies)
    // TODO check requests and replies map to remote correctly

    // exit point from system to covenant
    const rxRequest = (index) => {
      if (address.isUnknown() && !isLoopback) {
        return
      }
      if (address.isInvalid()) {
        return
      }
      if (!Number.isInteger(index)) {
        index = getNextReplyIndex()
      }
      const request = remote.requests[index]
      if (request) {
        assert(actionModel.isModel(request))
        const { type, payload } = request
        const rxRequest = rxRequestModel.create(type, payload, address, index)
        debug(`rxRequest ${rxRequest.type}`)
        return rxRequest
      }
    }
    // exit point from system to covenant
    const rxReplyIndex = () => {
      if (address.isUnknown()) {
        return
      }
      const replyIndices = _getSortedIndices(remote.replies)
      let replyIndex = replyIndices.find((index) => {
        const reply = remote.replies[index]
        return !reply.isPromise() && requests[index]
      })
      if (!Number.isInteger(replyIndex) && address.isInvalid()) {
        // next reply is the same index as the next request
        const requestIndices = getRequestIndices()
        for (const index of requestIndices) {
          const reply = remote.replies[index]
          if (!reply || reply.isPromise()) {
            replyIndex = index
            break
          }
        }
      }
      return replyIndex
    }

    const rxReply = () => {
      const index = rxReplyIndex()
      if (!Number.isInteger(index)) {
        return
      }
      assert(index >= 0, `index must be whole number`)
      assert(requests[index], `No request for: ${index}`)
      let replyRaw
      if (address.isInvalid()) {
        replyRaw = reject(new Error(`Channel invalid`))
      } else {
        assert(remote.replies[index], `No reply for: ${index}`)
        replyRaw = remote.replies[index]
      }
      const origin = requests[index]
      const { type, payload } = replyRaw
      const reply = rxReplyModel.create(type, payload, origin)
      return reply
    }
    const getNextReplyIndex = () => {
      // get lowest remote request index that is higher than reply index
      const remoteRequestIndices = _getSortedIndices(remote.requests)
      // remoteRequestIndices.reverse()
      for (const index of remoteRequestIndices) {
        if (!replies[index]) {
          return index
        }
      }
    }
    const getRemoteRequestIndices = () => _getSortedIndices(remote.requests)
    const getRemoteReplyIndices = () => _getSortedIndices(remote.replies)
    const isTxGreaterThan = (previous) => {
      assert(channelModel.isModel(previous))
      const isAddressChanged = !previous.address.equals(address)
      const isReplies = isNewReplies(replies, previous.replies)
      const isRequests = isNewActions(requests, previous.requests)
      const isPromises = isNewPromiseSettled(replies, previous.replies)
      return isAddressChanged || isReplies || isRequests || isPromises
    }

    const getRemote = () => remote
    const getOutboundPairs = () =>
      _getSortedIndices(requests).map((i) => [requests[i], remote.replies[i]])
    const getRequestIndices = () => _getSortedIndices(requests)

    return {
      rxRequest,
      rxReply,
      rxReplyIndex,
      getNextReplyIndex,
      getRemoteRequestIndices,
      getRemoteReplyIndices,
      isTxGreaterThan,
      getRemote,
      getOutboundPairs,
      getRequestIndices,
    }
  },
})
const isNewPromiseSettled = (current, previous) => {
  const currentIndices = _getSortedIndices(current)
  const isPromiseSettled = currentIndices.some((index) => {
    const currentAction = current[index]
    const previousAction = previous[index]
    if (!previousAction || !currentAction) {
      return false
    }
    assert(continuationModel.isModel(currentAction))
    assert(continuationModel.isModel(previousAction))
    const settled = previousAction.isPromise() && !currentAction.isPromise()
    return settled
  })
  return isPromiseSettled
}
const isNewReplies = (currentReplies, previousReplies) => {
  const currentIndices = _getSortedIndices(currentReplies)
  while (isTipPromise(currentIndices, currentReplies)) {
    currentIndices.pop()
  }
  if (!currentIndices.length) {
    return false
  }
  const previousIndices = _getSortedIndices(previousReplies)
  const isNewActions = isHigherThan(currentIndices, previousIndices)
  return isNewActions
}
const isTipPromise = (indicies, replies) => {
  if (!indicies.length) {
    return false
  }
  const index = last(indicies)
  return replies[index].isPromise()
}
const isNewActions = (current, previous) => {
  const currentIndices = _getSortedIndices(current)
  const previousIndices = _getSortedIndices(previous)
  const isNewActions = isHigherThan(currentIndices, previousIndices)
  return isNewActions
}
const _getSortedIndices = (obj) => {
  const indices = []
  Object.keys(obj).forEach((key) => {
    const number = parseInt(key)
    assert(number >= 0, `Index out of bounds: ${number}`)
    indices.push(number)
  })
  indices.sort((first, second) => first - second)
  return indices
}
const _checkAllInts = (obj) => _getSortedIndices(obj)
const isHigherThan = (current, previous) => {
  if (!previous.length && !current.length) {
    return false
  }
  if (!previous.length && current.length) {
    return true
  }
  if (previous.length && !current.length) {
    return false
  }
  const previousHighest = last(previous)
  const currentHighest = last(current)
  return currentHighest > previousHighest
}
module.exports = { channelModel }
