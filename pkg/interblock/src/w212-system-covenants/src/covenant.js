const reducer = (request) => {
  if (request.type !== '@@INIT') {
    throw new Error(`Covenant was sent request: ${request.type}`)
  }
}

const covenantSchema = {
  // TODO define this schema
  type: 'object',
  description: `Valid formats for a Covenant, which may be nested.`,
  required: ['reducer'],
  additionalProperties: false,
  properties: {
    reducer: {
      type: 'null',
      description: `Function to return next state.  Replaced by a throwing
        default if none supplied`,
      nullable: true,
    },
    api: {
      type: 'object',
      description: `object with keys defining schema for actions.
        Used in auto generating forms and commandline args.`,
      additionalProperties: false,
      patternProperties: {
        '(.*?)': {
          type: 'object',
          definition: `Schema for an action`,
          required: ['type', 'payload'],
          properties: {
            type: { type: 'string' },
            payload: { type: 'object' },
          },
        },
      },
    },
    installer: {
      type: 'object',
      description: `Config file for creating multiple chains in a heirarchy,
        and connecting them together.`,
    },
  },
}
export { reducer }
