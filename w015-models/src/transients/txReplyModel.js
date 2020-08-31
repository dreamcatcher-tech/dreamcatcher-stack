const assert = require('assert')
const { standardize } = require('../utils')
const { continuationModel } = require('../models/continuationModel')
const { txReplySchema } = require('../schemas/transientSchemas')
const splitSequence = require('./splitSequence')

const txReplyModel = standardize({
  schema: txReplySchema,
  create(type = '@@RESOLVE', payload = {}, sequence) {
    assert.equal(typeof payload, 'object')
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
    const getContinuation = () => continuation
    return { getAddress, getIndex, getContinuation }
  },
})

module.exports = { txReplyModel }
