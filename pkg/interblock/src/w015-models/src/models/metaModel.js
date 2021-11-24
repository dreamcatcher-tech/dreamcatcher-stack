import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { rxReplyModel } from '../transients'

// TODO move to array model so can compute diffs and hashes faster
const schema = {
  title: 'Meta',
  type: 'object',
  required: ['replies'],
  // TODO identifier regex for replies
  properties: { replies: { type: 'object' }, deploy: { type: 'object' } },
  additionalProperties: false,
}

const metaModel = standardize({
  schema,
  create() {
    return metaModel.clone({ replies: {} })
  },
  logicize(instance) {
    const { replies } = instance
    for (const slice of Object.values(replies)) {
      assert.strictEqual(typeof slice.type, 'string', `Must supply type`)
    }
    const isAwaiting = (reply) => {
      assert(rxReplyModel.isModel(reply))
      return !!replies[reply.identifier]
    }
    const getMetaSlice = (reply) => {
      assert(rxReplyModel.isModel(reply))
      assert(isAwaiting(reply))
      return replies[reply.identifier]
    }
    return { isAwaiting, getMetaSlice }
  },
})

export { metaModel }
