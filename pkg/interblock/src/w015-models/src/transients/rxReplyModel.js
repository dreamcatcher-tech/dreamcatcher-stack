import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { actionModel } from '../models/actionModel'
import { rxReplySchema } from '../schemas/transientSchemas'

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

export { rxReplyModel }
