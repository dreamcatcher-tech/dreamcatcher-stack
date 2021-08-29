import { standardize } from '../modelUtils'

const timestampModel = standardize({
  schema: {
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
  },
  create() {
    const now = new Date()
    const date = now.toISOString()
    const ms = now.valueOf()
    return timestampModel.clone({ date, ms })
  },
  logicize(instance) {
    const isExpired = (expiresAfterMs) => {
      const now = Date.now()
      const msElapsed = now - instance.ms
      return msElapsed >= expiresAfterMs
    }
    return { isExpired }
  },
})

export { timestampModel }
