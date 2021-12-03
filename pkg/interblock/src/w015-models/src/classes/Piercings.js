import assert from 'assert-fast'
import { Action, Continuation } from '.'
import { mixin } from './MapFactory'

const schema = {
  title: 'Piercings',
  type: 'object',
  //   description: `Stores piercings in minimal form so can be replayed by validators`,
  required: ['replies', 'requests'],
  additionalProperties: false,
  properties: {
    replies: {
      type: 'object',
      // description: `Keys are of format blockheight_index`,
      additionalProperties: false,
      patternProperties: {
        '[0-9]+_[0-9]+': Continuation.schema,
      },
    },
    requests: {
      type: 'array',
      uniqueItems: true,
      items: Action.schema,
    },
  },
}
export class Piercings extends mixin(schema) {
  static create(replies, requests) {
    assert(Object.values(replies).every((v) => v instanceof Continuation))
    assert(requests.every((r) => r instanceof Action))
    const piercings = { replies, requests }
    return super.create(piercings)
  }
}
