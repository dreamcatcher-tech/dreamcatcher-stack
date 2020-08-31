const { standardize } = require('../utils')

const schema = {
  title: 'Config',
  description: `Configuration options for the chain`,
  type: 'object',
  required: ['isPierced', 'isSideEffectCapable', 'isPublicChannelOpen'],
  additionalProperties: false,
  properties: {
    isPierced: {
      type: 'boolean',
      description: 'If the chain should be reduced, even with no known actions',
    },
    isSideEffectCapable: {
      type: 'boolean',
      description: 'When reducing, will this chain be allowed network access',
    },
    isPublicChannelOpen: {
      type: 'boolean',
      description:
        'Will the validators open up new channels on request from unknown chains',
    },
  },
}

const configModel = standardize({
  schema,
  create(opts = {}) {
    const config = {
      isPierced: false,
      isSideEffectCapable: false,
      isPublicChannelOpen: false,
    }
    return configModel.clone({ ...config, ...opts })
  },
  logicize(instance) {
    return {}
  },
})

module.exports = { configModel }
