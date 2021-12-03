import assert from 'assert-fast'
import { actionModel, continuationModel } from '..'
import { standardize } from '../../modelUtils'

const schema = {
  title: 'Piercings',
  type: 'object',
  //   description: `Stores piercings in minimal form so can be replayed by validators`,
  required: ['replies', 'requests'],
  additionalProperties: false,
  properties: {
    replies: {
      type: 'object',
      // description: `Keys are of format blockheight_index`,
      additionalProperties: false,
      patternProperties: {
        '[0-9]+_[0-9]+': continuationModel.schema,
      },
    },
    requests: {
      type: 'array',
      uniqueItems: true,
      items: actionModel.schema,
    },
  },
}

const piercingsModel = standardize({
  schema,
  create(replies, requests) {
    assert(Object.values(replies).every(continuationModel.isModel))
    assert(requests.every(actionModel.isModel))
    const piercings = { replies, requests }
    return piercingsModel.clone(piercings)
  },
  logicize(instance) {
    return {}
  },
})

export { piercingsModel }
