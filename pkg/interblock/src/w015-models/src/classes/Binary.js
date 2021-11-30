import { mixin } from './MapFactory'
import { Integrity } from '.'

const schema = {
  title: 'Binary',
  type: 'object',
  // description: `Manages the binary attached to each chain.`,
  additionalProperties: false,
  required: ['integrity', 'size'],
  properties: {
    integrity: Integrity.schema,
    size: { type: 'integer', minimum: 0 },
  },
}

export class Binary extends mixin(schema) {
  create(integrity = Integrity.create(), size = 0) {
    return super.create({ integrity, size })
  }
}
