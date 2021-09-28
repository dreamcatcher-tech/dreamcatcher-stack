import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { remoteSchema } from '../schemas/modelSchemas'
import { addressModel } from './addressModel'

const remoteModel = standardize({
  schema: remoteSchema,
  create(remote = {}) {
    assert(typeof remote === 'object')
    const supplied = {}
    const keys = [
      'address',
      'requests',
      'replies',
      'heavyHeight',
      'lineageHeight',
    ]
    keys.forEach((key) => {
      if (remote[key]) {
        supplied[key] = remote[key]
      }
    })
    const defaultInstance = {
      address: addressModel.create(),
      requests: {},
      replies: {},
      heavyHeight: -1,
      lineageHeight: -1,
    }
    const instance = { ...defaultInstance, ...supplied }
    return remoteModel.clone(instance)
  },
  logicize(instance) {
    return {}
  },
})

export { remoteModel }
