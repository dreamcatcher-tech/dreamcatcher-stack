import assert from 'assert-fast'
import { Socket } from '.'
import { Interblock } from '../..'
import { mixin } from '../MapFactory'
const schema = {
  title: 'Tx',
  // description: `An interblock plus socket info, used for transmission functions`,
  type: 'object',
  required: ['socket', 'interblock'],
  additionalProperties: false,
  properties: {
    socket: Socket.schema,
    interblock: Interblock.schema,
  },
}
export class Tx extends mixin(schema) {
  static create(socket = Socket.create(), interblock) {
    assert(socket instanceof Socket)
    assert(interblock instanceof Interblock)
    return super.create({ socket, interblock })
  }
}
