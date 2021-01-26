const { standardize } = require('../modelUtils')
const { actionSchema } = require('../schemas/modelSchemas')

let counter = 0
const defaultAction = () => `DEFAULT_ACTION_${counter++}`

const actionModel = standardize({
  schema: actionSchema,
  create(action = defaultAction(), payload = {}) {
    if (typeof action === 'string') {
      action = { type: action, payload }
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
