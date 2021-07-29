import { standardize } from '../modelUtils'
import { actionSchema } from '../schemas/modelSchemas'

const actionModel = standardize({
  schema: actionSchema,
  create(action, payload = {}) {
    if (typeof action === 'undefined') {
      throw new Error(`Actions cannot be undefined`)
    }
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

export { actionModel }
