import { actionSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Action extends mixin(actionSchema) {
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
    return super.create(action)
  }
}
