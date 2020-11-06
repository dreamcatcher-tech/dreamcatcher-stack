const assert = require('assert')
const { standardize } = require('../utils')

// TODO remove this when can handle arrays in patterns
const simpleArrayModel = standardize({
  schema: {
    title: 'SimpleArray',
    description: 'ascending indexes of requests to process',
    type: 'array',
    uniqueItems: true,
    items: { type: 'number', minimum: 0, multipleOf: 1 },
  },
  create() {
    return simpleArrayModel.clone([])
  },
  logicize(instance) {
    assert(
      instance.every((value, index) => {
        if (!index) {
          return true
        }
        return value > instance[index - 1]
      }, `Values not monotonic: ${instance}`)
    )
    return {}
  },
})

module.exports = { simpleArrayModel }
