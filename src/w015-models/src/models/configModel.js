import { standardize } from '../modelUtils'

const schema = {
  title: 'Config',
  // description: `Configuration options for the chain`,
  type: 'object',
  required: ['isPierced', 'sideEffects', 'isPublicChannelOpen'],
  additionalProperties: false,
  properties: {
    isPierced: {
      type: 'boolean',
      // description: 'If the chain should be reduced, even with no known actions',
    },
    sideEffects: {
      type: 'object',
      // description: 'When reducing, will this chain be allowed network access',
      required: ['networkPatterns', 'asyncTimeoutMs'],
      properties: {
        networkPatterns: {
          type: 'array',
          // description: 'Empty string means no network access',
          items: { type: 'string', format: 'regex' },
        },
        asyncTimeoutMs: {
          type: 'number',
          // description: '0 means no timeout allowed',
          minimum: 0,
        },
      },
    },
    isPublicChannelOpen: {
      type: 'boolean',
      // description:
      //   'Will the validators open up new channels on request from unknown chains',
    },
  },
}

const configModel = standardize({
  schema,
  create(opts = {}) {
    const sideEffects = { networkPatterns: [''], asyncTimeoutMs: 0 }
    opts = { ...opts, sideEffects: { ...sideEffects, ...opts.sideEffects } }
    const config = {
      isPierced: false,
      sideEffects,
      isPublicChannelOpen: false,
    }
    return configModel.clone({ ...config, ...opts })
  },
  logicize(instance) {
    // TODO check that if no async, network is also disabled
    return {}
  },
})

export { configModel }
