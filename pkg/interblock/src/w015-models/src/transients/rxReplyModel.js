import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { rxReplySchema } from '../schemas/transientSchemas'
import { splitSequence } from './splitSequence'

const rxReplyModel = standardize({
  schema: rxReplySchema,
  create(type = '@@RESOLVE', payload = {}, address, height, index) {
    const identifier = `${address.getChainId()}_${height}_${index}`
    const rxReply = { type, payload, identifier }
    return rxReplyModel.clone(rxReply)
  },
  logicize(instance) {
    // TODO reuse the same checks in rxRequest ??
    const { identifier } = instance
    const { address, height, index } = splitSequence(identifier)
    assert(!address.isUnknown())
    assert(Number.isInteger(height))
    assert(height >= 0)
    assert(Number.isInteger(index))
    assert(index >= 0)
    const isReply = () => true
    const getAddress = () => address
    const getHeight = () => height
    const getIndex = () => index
    return { isReply, getAddress, getHeight, getIndex }
  },
})

export { rxReplyModel }
