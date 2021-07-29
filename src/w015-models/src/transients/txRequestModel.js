import assert from 'assert'
const { standardize } = require('../modelUtils')
const { actionModel } = require('../models/actionModel')
const { txRequestSchema } = require('../schemas/transientSchemas')

const txRequestModel = standardize({
  schema: txRequestSchema,
  create(type = 'DEFAULT_TX_REQUEST', payload = {}, to = '.') {
    assert.strictEqual(typeof payload, 'object')
    const txRequest = { type, payload, to }
    return txRequestModel.clone(txRequest)
  },
  logicize(instance) {
    // TODO if to matches chainId regex length, ensure full match
    const { type, payload, to } = instance
    const request = actionModel.create({ type, payload })
    const getRequest = () => request
    return { getRequest }
  },
})

module.exports = { txRequestModel }
