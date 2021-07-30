const txRequestSchema = {
  title: `txRequest`,
  description: `Covenant created`,
  type: 'object',
  required: ['type', 'payload', 'to'],
  additionalProperties: false,
  properties: {
    type: { type: 'string' },
    payload: { type: 'object' },
    to: { type: 'string' },
  },
}

const rxRequestSchema = {
  title: `rxRequest`,
  description: `System created inside ChannelModel`,
  type: 'object',
  required: ['type', 'payload', 'sequence'], // we destroy who they sent it to
  additionalProperties: false,
  properties: {
    type: { type: 'string' },
    payload: { type: 'object' },
    // TODO regex on format of sequence
    sequence: { type: 'string', pattern: '' }, // chainId_index
  },
}

const txReplySchema = {
  title: `txReply`,
  description: `Covenant created`,
  type: 'object',
  required: ['type', 'payload', 'request'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['@@REJECT', '@@PROMISE', '@@RESOLVE'] },
    payload: { type: 'object' },
    request: {
      // kept nested so closely resembles how the api constructs actions
      description: `Sequence created in rxRequest`,
      type: 'object',
      required: ['sequence'], // we destroy who they sent it to
      additionalProperties: false,
      properties: {
        sequence: { type: 'string', pattern: '' }, // chainId_index
      },
    },
  },
}
const rxReplySchema = {
  title: `rxReply`,
  description: `System created.
Create requires the sequence to be included.
@@PROMISE cannot ever be dispatched to a reducer, hence its exclusion from "type"`,
  type: 'object',
  required: ['type', 'payload', 'request'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['@@REJECT', '@@RESOLVE'] },
    payload: { type: 'object' },
    request: {
      description: `Covenants original request, without the 'to' field`,
      type: 'object',
      required: ['type', 'payload'],
      additionalProperties: false,
      properties: {
        type: { type: 'string' },
        payload: { type: 'object' },
      },
    },
  },
}

export { txRequestSchema, rxRequestSchema, txReplySchema, rxReplySchema }
