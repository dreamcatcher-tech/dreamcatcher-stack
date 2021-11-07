import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { splitSequence } from './splitSequence'
import { actionModel } from '../models'
import { rxRequestSchema } from '../schemas/transientSchemas'

const rxRequestModel = standardize({
  schema: rxRequestSchema,
  create(type, payload, address, height, index) {
    // TODO make this creation args less like passing in an interblock directly
    const identifier = `${address.getChainId()}_${height}_${index}`
    const rxRequest = { type, payload, identifier }
    return rxRequestModel.clone(rxRequest)
  },
  logicize(instance) {
    const { type, payload, identifier } = instance
    const { address, height, index } = splitSequence(identifier)
    assert(!address.isUnknown())
    assert(Number.isInteger(height))
    assert(height >= 0)
    assert(Number.isInteger(index))
    assert(index >= 0)

    let request

    const getAddress = () => address
    const getHeight = () => height
    const getIndex = () => index
    const getReplyKey = () => `${height}_${index}`
    const getRequest = () => {
      if (!request) {
        request = actionModel.create({ type, payload })
      }
      return request
    }
    const isReply = () => false
    const getLogEntry = () =>
      `${type} ${address.getChainId().substring(0, 9)} ${getReplyKey()}`

    return {
      getAddress,
      getHeight,
      getIndex,
      getReplyKey,
      getRequest,
      isReply,
      getLogEntry,
    }
  },
})

export { rxRequestModel }
