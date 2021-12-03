import { mixin } from './MapFactory'
import { RxReply } from '.'
import { ciKeypair } from '../../../w012-crypto'
const schema = {
  type: 'object',
  title: 'Accumulation',
  required: ['type'],
  properties: {
    type: { type: 'string' },
    to: { type: 'string' }, // TODO pattern for allowed alias names
    reply: RxReply.schema,
    identifier: { type: 'string', pattern: '' }, // chainId_height_index
  },
}
export class Accumulation extends mixin(schema) {}
