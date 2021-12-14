import assert from 'assert-fast'
import { serializeError } from 'serialize-error'
import { standardize } from '../../modelUtils'
import { continuationSchema } from '../../schemas/modelSchemas'

const continuationModel = standardize({
  schema: continuationSchema,
  create(type = '@@RESOLVE', payload = {}) {
    if (type === '@@REJECT') {
      payload = serializeError(payload)
    }
    return continuationModel.clone({ type, payload })
  },
  logicize(instance) {
    if (instance.type === '@@PROMISE') {
      assert.strictEqual(
        Object.keys(instance.payload).length,
        0,
        `Promises cannot have payloads`
      )
    }

    const isPromise = () => instance.type === '@@PROMISE'
    const isRejection = () => instance.type === '@@REJECT'
    const isResolve = () => instance.type === '@@RESOLVE'
    return { isPromise, isRejection, isResolve }
  },
})

export { continuationModel }
