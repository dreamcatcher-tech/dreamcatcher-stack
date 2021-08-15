import assert from 'assert'
import { v4 as uuid } from 'uuid'
import { standardize } from '../modelUtils'

const selfSocket = {
  id: 'fd9e9077-cda5-4b1d-afbf-c8a7cf648ded',
  type: 'internal',
  info: {},
}

const socketModel = standardize({
  schema: {
    title: 'Socket',
    // description: `Socket info, used to store info about block producers`,
    type: 'object',
    required: ['id', 'type', 'info'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' }, // TODO regex for uuid
      type: {
        enum: ['internal', 'websocket', 'https', 'email', 'udp'],
      },
      info: { type: 'object' },
    },
  },
  create(socketInfo = selfSocket) {
    socketInfo = { id: uuid(), type: 'internal', info: {}, ...socketInfo }
    return socketModel.clone({ ...socketInfo })
  },
  logicize(instance) {
    const getIsInternal = () => instance.type === 'internal'
    return { getIsInternal }
  },
})

export { socketModel }
