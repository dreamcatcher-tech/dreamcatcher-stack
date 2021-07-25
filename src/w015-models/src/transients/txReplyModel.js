const assert = require('assert')
const { standardize } = require('../modelUtils')
const { continuationModel } = require('../models/continuationModel')
const { txReplySchema } = require('../schemas/transientSchemas')
const splitSequence = require('./splitSequence')

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

module.exports = { txReplyModel }