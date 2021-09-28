import assert from 'assert-fast'
import { standardize } from '../modelUtils'

// TODO remove this when can handle arrays in patterns
const simpleArrayModel = standardize({
  schema: {
    title: 'SimpleArray',
    // description: 'ascending indexes of requests to process',
    type: 'array',
    uniqueItems: true,
    items: { type: 'number', minimum: 0, multipleOf: 1 },
  },
  create() {
    return simpleArrayModel.clone([])
  },
  logicize(instance) {
    const isMonotonic = instance.every((value, index) => {
      if (!index) {
        return true
      }
      return value > instance[index - 1]
    })
    assert(isMonotonic, `Values not monotonic: ${instance}`)
    return {}
  },
})

export { simpleArrayModel }
