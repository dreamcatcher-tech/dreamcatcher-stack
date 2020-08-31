const assert = require('assert')
const { standardize } = require('../utils')
const { continuationSchema } = require('../schemas/modelSchemas')

const continuationModel = standardize({
  schema: continuationSchema,
  // TODO if not promise or reject, then use the action model to avoid enveloping ?
  create(type = '@@RESOLVE', payload = {}) {
    return continuationModel.clone({ type, payload })
  },
  logicize(instance) {
    if (instance.type === '@@PROMISE') {
      assert.deepStrictEqual(
        instance.payload,
        {},
        `Promises cannot have payloads`
      )
    }
    const isPromise = () => instance.type === '@@PROMISE'
    const isRejection = () => instance.type === '@@REJECT'
    const isResolve = () => instance.type === '@@RESOLVE'
    return { isPromise, isRejection, isResolve }
  },
})

module.exports = { continuationModel }
