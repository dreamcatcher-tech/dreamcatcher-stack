const txRequestSchema = {
  title: `TxRequest`,
  // description: `Covenant created`,
  type: 'object',
  required: ['type', 'payload', 'to'],
  additionalProperties: false,
  properties: {
    type: { type: 'string' },
    payload: { type: 'object' },
    to: { type: 'string' },
    // when called directly in hooks,
    // returns a chainId_height_index identifier
    // which means direct calls must have a chainId already
    // else mapping back cannot handle alias renames
  },
}
const rxRequestSchema = {
  title: `RxRequest`,
  // description: `System created inside Channel`,
  type: 'object',
  required: ['type', 'payload', 'identifier'],
  additionalProperties: false,
  properties: {
    type: { type: 'string' },
    payload: { type: 'object' },
    identifier: { type: 'string', pattern: '' }, // chainId_height_index
  },
}
const txReplySchema = {
  title: `TxReply`,
  // description: `Covenant created`,
  type: 'object',
  required: ['type', 'payload', 'identifier'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['@@REJECT', '@@PROMISE', '@@RESOLVE'] },
    payload: { type: 'object' },
    identifier: { type: 'string', pattern: '' }, // chainId_height_index
  },
}
const rxReplySchema = {
  title: `RxReply`,
  //   description: `System created.
  // Create requires the sequence to be included.
  // @@PROMISE cannot ever be dispatched to a reducer, hence its exclusion from "type"`,
  type: 'object',
  required: ['type', 'payload', 'identifier'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['@@REJECT', '@@RESOLVE'] },
    payload: { type: 'object' },
    identifier: { type: 'string', pattern: '' }, // chainId_height_index
  },
}

export { txRequestSchema, rxRequestSchema, txReplySchema, rxReplySchema }
