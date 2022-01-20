import assert from 'assert-fast'
import equals from 'fast-deep-equal'
import { actionSchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import { assertNoUndefined } from './State'
export class Action extends mixin(actionSchema) {
  static create(action, payload = {}) {
    if (typeof action === 'undefined') {
      throw new Error(`Actions cannot be undefined`)
    }
    if (typeof action === 'string') {
      action = { type: action, payload }
    }
    if (!action.payload) {
      action = { ...action, payload: {} }
    }
    assertNoUndefined(action.payload)
    const cloned = JSON.parse(JSON.stringify(action.payload))
    assert(equals(action.payload, cloned), 'payload must be stringifiable')
    return super.create(action)
  }
}
