import assert from 'assert-fast'
import last from 'lodash.last'
import { standardize } from '../modelUtils'
import { addressModel } from './addressModel'
import { continuationModel } from './continuationModel'
import { remoteModel } from './remoteModel'
import { channelSchema } from '../schemas/modelSchemas'
import Debug from 'debug'
const debug = Debug('interblock:models:channel')

const channelModel = standardize({
  schema: channelSchema,
  create(address, systemRole = 'DOWN_LINK') {
    // TODO calculate systemRole from alias
    address = addressModel.clone(address)
    const remote = remoteModel.create({ address })
    const channel = {
      ...remote,
      systemRole,
    }
    return channelModel.clone(channel)
  },
  logicize(instance) {
    // TODO if reset address, must clear all remote requests, else promises break
    // TODO check no duplicate requests in channel - must be distiguishable
    // TODO why does duplicate detection in the channel matter ? isReplyFor() ?
    // TODO check that replies keys are always consequtive, and they match
    // the temporaryInterblocks array.  Could only be disjoint if came before
    // the current interblocks, else must be in order, and cannot be beyond
    // The order must match the interblocks for keys, so can walk the conflux
    const {
      address,
      replies,
      requests,
      precedent,
      systemRole,
      rxRepliesTip,
      tip,
      tipHeight,
    } = instance
    const isLoopback = systemRole === '.'

    if (address.isUnknown()) {
      assert.strictEqual(Object.keys(replies).length, 0)
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
    }
    // TODO if this is pierce channel, ensure only requests are OOB effects ?

    if (isLoopback) {
      assert(address.isLoopback())
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
      assert(precedent.isUnknown())
      const banned = ['@@OPEN_CHILD']
      const outs = Object.values(requests)
      assert(outs.every(({ type }) => !banned.includes(type)))
    }

    if (tip) {
      assert(!tip.isUnknown())
      assert(tipHeight >= 0)
    }

    const isTxGreaterThan = (previous) => {
      assert(channelModel.isModel(previous))
      const isAddressChanged = !previous.address.equals(address)
      const isReplies = isNewReplies(replies, previous.replies)
      const isRequests = isNewActions(requests, previous.requests)
      const isPromises = isNewPromiseSettled(replies, previous.replies)
      return isAddressChanged || isReplies || isRequests || isPromises
    }

    const getOutboundPairs = () =>
      _getSortedIndices(requests).map((i) => [requests[i], replies[i]])
    const getRequestIndices = () => _getSortedIndices(requests)

    return {
      isTxGreaterThan,
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
export { channelModel }
