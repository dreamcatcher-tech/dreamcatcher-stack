import { mixin } from '../MapFactory'
import assert from 'assert-fast'
import { v4 as uuid } from 'uuid'
const schema = {
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
}
const selfSocket = {
  id: 'fd9e9077-cda5-4b1d-afbf-c8a7cf648ded',
  type: 'internal',
  info: {},
}

export class Socket extends mixin(schema) {
  static create(socket = selfSocket) {
    socket = { id: uuid(), type: 'internal', info: {}, ...socket }
    return super.create(socket)
  }
  getIsInternal() {
    return this.type === 'internal'
  }
}
