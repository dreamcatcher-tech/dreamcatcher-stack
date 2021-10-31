import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { addressModel } from './addressModel'
import { remoteModel } from './remoteModel'
import { channelSchema } from '../schemas/modelSchemas'
import { rxReplyModel, rxRequestModel } from '../transients'
import Debug from 'debug'
import { continuationModel } from '.'
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
      rxPromises,
      rxRepliesTip,
      tip,
      tipHeight,
    } = instance
    const _isLoopback = systemRole === '.'
    // TODO assert the order of rxPromises and txPromises is sequential
    if (address.isUnknown()) {
      assert.strictEqual(Object.keys(replies).length, 0)
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
    }
    // TODO if this is pierce channel, ensure only requests are OOB effects ?

    if (_isLoopback) {
      // TODO check rxRepliesTip matches what is in the reply object
      assert(address.isLoopback())
      assert.strictEqual(typeof tip, 'undefined')
      assert(precedent.isUnknown())
      const banned = ['@@OPEN_CHILD']
      const outs = Object.values(requests)
      assert(outs.every(({ type }) => !banned.includes(type)))
    }
    if (Number.isInteger(tipHeight)) {
      assert(tipHeight >= 0)
      assert(_isLoopback || !tip.isUnknown())
    }

    if (tip) {
      assert(!_isLoopback)
      assert(!tip.isUnknown())
      assert(tipHeight >= 0)
    }
    const isTransmitting = () =>
      !!requests.length || !!Object.keys(replies).length
    const isLoopback = () => _isLoopback

    const _splitKey = (key) => {
      const [sHeight, sIndex] = key.split('_')
      const height = Number.parseInt(sHeight)
      const index = Number.parseInt(sIndex)
      return [height, index]
    }

    const rxLoopbackSettle = () => {
      let _rxPromises = rxPromises || []
      for (const promisedKey of _rxPromises) {
        const reply = replies[promisedKey]
        if (reply) {
          assert(continuationModel.isModel(reply))
          if (!reply.isPromise()) {
            const { type, payload } = reply
            const [height, index] = _splitKey(promisedKey)
            return rxReplyModel.create(type, payload, address, height, index)
          }
        }
      }
    }

    const _nextCoords = () => {
      let nextHeight = Number.isInteger(tipHeight) ? tipHeight + 1 : 0
      let nextIndex = 0
      if (typeof rxRepliesTip === 'string') {
        const [height, index] = _splitKey(rxRepliesTip)
        assert(height <= nextHeight)
        if (height === nextHeight) {
          nextIndex = index + 1
        }
      }
      return [nextHeight, nextIndex]
    }
    const _rxLoopbackContinuation = () => {
      if (Object.keys(replies).length) {
        const [nextHeight, nextIndex] = _nextCoords()
        // TODO assert no replies higher than this one are present
        const key = `${nextHeight}_${nextIndex}`
        if (replies[key]) {
          const action = replies[key]
          return [action, nextHeight, nextIndex]
        }
      }
      return []
    }
    const rxLoopbackReply = () => {
      const [action, height, index] = _rxLoopbackContinuation()
      if (!action || action.type === '@@PROMISE') {
        return
      }
      const { type, payload } = action
      return rxReplyModel.create(type, payload, address, height, index)
    }
    const isLoopbackReplyPromised = () => {
      const [action] = _rxLoopbackContinuation()
      if (action && action.type === '@@PROMISE') {
        return true
      }
      return false
    }

    const rxLoopbackRequest = () => {
      assert(_isLoopback)
      const [nextHeight, nextIndex] = _nextCoords()
      if (requests[nextIndex]) {
        const { type: t, payload: p } = requests[nextIndex]
        return rxRequestModel.create(t, p, address, nextHeight, nextIndex)
      }
    }

    const isLoopbackExhausted = () => {
      if (rxLoopbackSettle()) {
        return false
      }
      if (rxLoopbackReply()) {
        return false
      }
      if (isLoopbackReplyPromised()) {
        return false
      }
      if (rxLoopbackRequest()) {
        return false
      }
      return true
    }
    const rxLoopback = () => {
      let rx
      rx = rxLoopbackSettle()
      if (rx) {
        return rx
      }
      rx = rxLoopbackReply()
      if (rx) {
        return rx
      }
      rx = rxLoopbackRequest()
      if (rx) {
        return rx
      }
    }

    return {
      isTransmitting,
      isLoopback,
      rxLoopbackSettle,
      rxLoopbackReply,
      rxLoopbackRequest,
      isLoopbackReplyPromised,
      isLoopbackExhausted,
      rxLoopback,
    }
  },
})
export { channelModel }
