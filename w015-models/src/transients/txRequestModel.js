const assert = require('assert')
const { standardize } = require('../utils')
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
    const { type, payload, to } = instance
    const action = actionModel.create({ type, payload })
    const getAction = () => action
    return { getAction }
  },
})

module.exports = { txRequestModel }
