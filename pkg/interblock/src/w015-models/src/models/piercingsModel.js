import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { txReplyModel, txRequestModel } from '../transients'

const schema = {
  title: 'Piercings',
  type: 'object',
  //   description: `Stores piercings in minimal form so can be replayed by validators`,
  required: ['replies', 'requests'],
  additionalProperties: false,
  properties: {
    requests: {
      type: 'array',
      uniqueItems: true,
      items: txRequestModel.schema,
    },
    replies: {
      type: 'array',
      uniqueItems: true,
      items: txReplyModel.schema,
    },
  },
}

const piercingsModel = standardize({
  schema,
  create(replies, requests) {
    assert(Array.isArray(replies))
    assert(Array.isArray(requests))
    assert(replies.every(txReplyModel.isModel))
    assert(requests.every(txRequestModel.isModel))
    const piercings = { replies, requests }
    return piercingsModel.clone(piercings)
  },
  logicize(instance) {
    return {}
  },
})

export { piercingsModel }
