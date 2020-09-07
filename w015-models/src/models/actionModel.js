const { standardize } = require('../utils')
const { actionSchema } = require('../schemas/modelSchemas')
const { assertNoUndefined } = require('../assertNoUndefined')

const defaultAction = 'DEFAULT_ACTION'

const actionModel = standardize({
  schema: actionSchema,
  create(action = defaultAction) {
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
