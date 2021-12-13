import { standardize } from '../../modelUtils'
import { rxReplyModel } from '../../transients' // TODO move transients to perm

const accumulationModel = standardize({
  schema: {
    type: 'object',
    title: 'Accumulation',
    required: ['type'],
    properties: {
      type: { type: 'string' },
      to: { type: 'string' }, // TODO pattern for allowed alias names
      reply: rxReplyModel.schema,
      identifier: { type: 'string', pattern: '' }, // chainId_height_index
    },
  },
  create() {
    throw new Error('can only be cloned')
  },
  logicize(instance) {
    return {}
  },
})

export { accumulationModel }
