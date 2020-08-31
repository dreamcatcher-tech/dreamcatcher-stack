const { standardize } = require('../utils')
const { actionSchema } = require('../schemas/modelSchemas')

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
    return {}
  },
})

module.exports = { actionModel }
