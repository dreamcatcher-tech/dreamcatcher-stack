const { standardize } = require('../utils')
const { actionSchema } = require('../schemas/modelSchemas')
const { assertNoUndefined } = require('../assertNoUndefined')

let counter = 0
const defaultAction = () => `DEFAULT_ACTION_${counter++}`

const actionModel = standardize({
  schema: actionSchema,
  create(action = defaultAction()) {
    if (typeof action === 'string') {
      action = { type: action }
    }
    if (!action.payload) {
      action = { ...action, payload: {} }
    }
    return actionModel.clone(action)
  },
  logicize(instance) {
    assertNoUndefined(instance)
    return {}
  },
})

module.exports = { actionModel }
