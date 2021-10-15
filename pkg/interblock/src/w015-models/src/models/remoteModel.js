import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { remoteSchema } from '../schemas/modelSchemas'
import { addressModel } from './addressModel'
import { integrityModel } from './integrityModel'

const _defaultInstance = {
  address: addressModel.create(),
  replies: {},
  requests: [],
  precedent: integrityModel.create(),
}
const remoteModel = standardize({
  schema: remoteSchema,
  create(remote = {}) {
    assert(typeof remote === 'object')
    const supplied = {}
    const keys = ['address', 'replies', 'requests', 'precedent']
    for (const key of keys) {
      if (remote[key]) {
        supplied[key] = remote[key]
      }
    }
    const instance = { ..._defaultInstance, ...supplied }
    return remoteModel.clone(instance)
  },
  logicize() {
    return {}
  },
})

export { remoteModel }
