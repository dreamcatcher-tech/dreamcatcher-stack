const assert = require('assert')
const debug = require('debug')('interblock:models:channel')
const _ = require('lodash')
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
      const { provenance } = _.last(lineageTip)
      assert.strictEqual(provenance.height, lineageHeight)
      assert(_.last(lineage).equals(provenance.reflectIntegrity()))
    }

    assert(lineageTip.every((interblock) => !interblock.getRemote()))
    checkMonotonic(requests) // TODO check requests length matches
    checkMonotonic(replies)

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
      const isNewReplies = isNewActions(replies, previous.replies)
      const isNewRequests = isNewActions(requests, previous.requests)
      const isNewPromises = isNewPromiseSettled(replies, previous.replies)
      return isAddressChanged || isNewReplies || isNewRequests || isNewPromises
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
    indices.push(number)
  })
  indices.sort((first, second) => first - second)
  return indices
}
const checkMonotonic = (obj) => {
  // TODO make an ordered array of all the indices, then run check on them
  let previous = -1
  const isMonotonic = Object.keys(obj).every((key) => {
    const number = parseInt(key)
    const greater = number > previous
    previous = number
    return greater
  })
  assert(isMonotonic)
}

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
  const baseHighest = _.last(previous)
  const checkHighest = _.last(current)
  return baseHighest < checkHighest
}
module.exports = { channelModel }
