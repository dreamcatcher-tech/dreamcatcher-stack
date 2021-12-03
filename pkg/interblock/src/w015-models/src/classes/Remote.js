import assert from 'assert-fast'
import { Integrity, Address } from '.'
import { remoteSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'

const defaultParams = {
  address: Address.create(),
  replies: {}, // TODO turn into array, to preserve order
  requests: [],
  precedent: Integrity.create(),
}
let baseInstance
export class Remote extends mixin(remoteSchema) {
  static create(remote) {
    if (!baseInstance) {
      baseInstance = super.create(defaultParams)
    }
    if (remote === undefined) {
      return baseInstance
    }
    assert(typeof remote === 'object')
    const params = { ...defaultParams }
    const keys = ['address', 'replies', 'requests', 'precedent']
    for (const key of keys) {
      if (remote[key]) {
        params[key] = remote[key]
      }
    }
    return super.create(params)
  }
}
