import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { continuationModel } from '../models/continuationModel'
import { txReplySchema } from '../schemas/transientSchemas'
import { splitSequence } from './splitSequence'

const txReplyModel = standardize({
  schema: txReplySchema,
  create(type = '@@RESOLVE', payload = {}, sequence) {
    // TODO may pass in txRequest model instead of sequence ?
    assert.strictEqual(typeof payload, 'object')
    const txReply = { type, payload, request: { sequence } }
    return txReplyModel.clone(txReply)
  },

  logicize(instance) {
    const { type, payload, request } = instance
    const { sequence } = request
    const { address, height, index } = splitSequence(sequence)
    const getAddress = () => address
    const getHeight = () => height // TODO remove height and index getters ?
    const getIndex = () => index
    const getReplyKey = () => `${height}_${index}`

    const continuation = continuationModel.create(type, payload)
    const getReply = () => continuation
    return { getAddress, getHeight, getIndex, getReply, getReplyKey }
  },
})

export { txReplyModel }
