import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { continuationModel } from '../models/continuationModel'
import { txReplySchema } from '../schemas/transientSchemas'
import { splitSequence } from './splitSequence'

const txReplyModel = standardize({
  schema: txReplySchema,
  create(type = '@@RESOLVE', payload = {}, identifier) {
    const txReply = { type, payload, identifier }
    if (type === '@@REJECT') {
      console.error(payload)
    }
    return txReplyModel.clone(txReply)
  },

  logicize(instance) {
    const { type, payload, identifier } = instance
    const { address, height, index } = splitSequence(identifier)
    const getAddress = () => address
    const getHeight = () => height
    const getIndex = () => index
    const getReplyKey = () => `${height}_${index}`

    const continuation = continuationModel.create(type, payload)
    const getReply = () => continuation
    return { getAddress, getHeight, getIndex, getReply, getReplyKey }
  },
})

export { txReplyModel }
