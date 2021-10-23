import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { actionModel } from '../models/actionModel'
import { txRequestSchema } from '../schemas/transientSchemas'
import posix from 'path-browserify'

const txRequestModel = standardize({
  schema: txRequestSchema,
  create(type = 'DEFAULT_TX_REQUEST', payload = {}, to = '.') {
    to = posix.normalize(to)
    const txRequest = { type, payload, to }
    return txRequestModel.clone(txRequest)
  },
  logicize(instance) {
    // TODO if to matches chainId regex length, ensure full match
    const { type, payload, to } = instance
    assert.strictEqual(typeof type, 'string')
    assert.strictEqual(typeof payload, 'object')
    assert.strictEqual(typeof to, 'string')
    const normalized = posix.normalize(to)
    assert.strictEqual(normalized, to, `"to" not normalized: ${to}`)

    const request = actionModel.create({ type, payload })
    const getRequest = () => request
    return { getRequest }
  },
})

export { txRequestModel }
