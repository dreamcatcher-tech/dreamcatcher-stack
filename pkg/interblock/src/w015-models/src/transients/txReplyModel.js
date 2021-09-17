import { assert } from 'chai/index.mjs'
import { standardize } from '../modelUtils'
import { continuationModel } from '../models/continuationModel'
import { txReplySchema } from '../schemas/transientSchemas'
import { splitSequence } from './splitSequence'

const txReplyModel = standardize({
  schema: txReplySchema,
  create(type = '@@RESOLVE', payload = {}, sequence) {
    assert.strictEqual(typeof payload, 'object')
    const txReply = { type, payload, request: { sequence } }
    return txReplyModel.clone(txReply)
  },

  logicize(instance) {
    const { type, payload, request } = instance
    const { sequence } = request
    const { address, index } = splitSequence(sequence)
    const getAddress = () => address
    const getIndex = () => index

    const continuation = continuationModel.create(type, payload)
    const getReply = () => continuation
    return { getAddress, getIndex, getReply }
  },
})

export { txReplyModel }
