import assert from 'assert'
const { standardize } = require('../modelUtils')
const { actionModel } = require('../models/actionModel')
const { rxReplySchema } = require('../schemas/transientSchemas')

const rxReplyModel = standardize({
  schema: rxReplySchema,
  create(type = '@@RESOLVE', payload = {}, request) {
    assert(actionModel.isModel(request), `Request not model: ${request}`)
    const rxReply = { type, payload, request }
    return rxReplyModel.clone(rxReply)
  },
  logicize(instance) {
    const { request } = instance
    const { type, payload } = request
    const originalAction = actionModel.create({ type, payload })

    const getRequest = () => originalAction
    const isReply = () => true
    return { getRequest, isReply }
  },
})

module.exports = { rxReplyModel }
