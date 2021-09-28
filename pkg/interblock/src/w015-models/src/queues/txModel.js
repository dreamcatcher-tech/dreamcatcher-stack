import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { interblockModel } from '../models/interblockModel'
import { socketModel } from './socketModel'

const txModel = standardize({
  schema: {
    title: 'Tx',
    // description: `An interblock plus socket info, used for transmission functions`,
    type: 'object',
    required: ['socket', 'interblock'],
    additionalProperties: false,
    properties: {
      socket: socketModel.schema,
      interblock: interblockModel.schema,
    },
  },
  create(socket = socketModel.create(), interblock) {
    assert(socketModel.isModel(socket))
    assert(interblockModel.isModel(interblock))
    return txModel.clone({ socket, interblock })
  },
  logicize(instance) {
    return {}
  },
})

export { txModel }
