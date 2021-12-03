import { mixin } from './MapFactory'

const schema = {
  title: 'Timestamp',
  type: 'object',
  // description: 'Time of issuance in standard format, with Zulu offset',
  additionalProperties: false,
  required: ['date', 'ms'],
  properties: {
    date: {
      type: 'string',
      format: 'date-time',
      examples: ['2011-10-05T14:48:00.000Z'],
    },
    ms: {
      type: 'integer',
    },
  },
}

export class Timestamp extends mixin(schema) {
  static create() {
    const now = new Date()
    const date = now.toISOString()
    const ms = now.valueOf()
    return super.create({ date, ms })
  }
  isExpired(expiresAfterMs) {
    const now = Date.now()
    const msElapsed = now - this.ms
    return msElapsed >= expiresAfterMs
  }
}
