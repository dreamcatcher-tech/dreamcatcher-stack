const { standardize } = require('../modelUtils')
const { integrityModel } = require('./integrityModel')

const binaryModel = standardize({
  schema: {
    title: 'Binary',
    type: 'object',
    description: `Manages the binary attached to each chain.`,
    additionalProperties: false,
    required: ['integrity', 'size'],
    properties: {
      integrity: integrityModel.schema,
      size: { type: 'number', minimum: 0 },
    },
  },
  create(integrity, size = 0) {
    integrity = integrityModel.clone(integrity)
    return binaryModel.clone({ integrity, size })
  },
  logicize(instance) {
    return {}
  },
})

module.exports = { binaryModel }
