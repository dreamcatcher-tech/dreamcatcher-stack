import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { splitSequence } from './splitSequence'
import { actionModel } from '../models'
import { addressModel } from '../models'
import { rxRequestSchema } from '../schemas/transientSchemas'

const rxRequestModel = standardize({
  schema: rxRequestSchema,
  create(type, payload, address, height, index) {
    // TODO make this creation args less like passing in an interblock directly
    assert(addressModel.isModel(address))
    assert(!address.isUnknown())
    const sequence = `${address.getChainId()}_${height}_${index}`
    const rxRequest = { type, payload, sequence }
    return rxRequestModel.clone(rxRequest)
  },
  logicize(instance) {
    const { type, payload, sequence } = instance
    const { address, height, index } = splitSequence(sequence)
    assert(!address.isUnknown())
    assert(Number.isInteger(height))
    assert(height >= 0)
    assert(Number.isInteger(index))
    assert(index >= 0)

    const request = actionModel.create({ type, payload })

    const getAddress = () => address
    const getHeight = () => height
    const getIndex = () => index
    const getRequest = () => request
    const isReply = () => false

    return { getAddress, getHeight, getIndex, getRequest, isReply }
  },
})

export { rxRequestModel }
