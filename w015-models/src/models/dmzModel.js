const assert = require('assert')
const { standardize } = require('../utils')
const { covenantIdModel } = require('./covenantIdModel')
const { timestampModel } = require('./timestampModel')
const { keypairModel } = require('./keypairModel')
const { aclModel } = require('./aclModel')
const { binaryModel } = require('./binaryModel')
const { integrityModel } = require('./integrityModel')
const { networkModel } = require('./networkModel')
const { stateModel } = require('./stateModel')
const { configModel } = require('./configModel')
const { validatorsModel } = require('./validatorsModel')

const schema = {
  type: 'object',
  title: 'Dmz',
  description: `DMZ coordinates all the models in one place.
Dmz is equivalent to CombineReducers in Redux.`,
  required: [
    'validators', // interblock
    'encryption', // interblock
    // TODO turn back on for prod, or set by first validator block
    // 'timestamp', // interblock
    'config',
    'network', // interblock
    'covenantId',
    'binaryIntegrity',
    'acl',
    'state',
  ],
  additionalProperties: false,
  properties: {
    validators: validatorsModel.schema,
    encryption: keypairModel.schema,
    config: configModel.schema,
    covenantId: covenantIdModel.schema,
    binaryIntegrity: binaryModel.schema,
    timestamp: timestampModel.schema,
    acl: aclModel.schema,
    network: networkModel.schema,
    state: stateModel.schema,
  },
}

const dmzModel = standardize({
  schema,
  create(opts = {}) {
    assert(typeof opts === 'object')
    const dmz = {
      validators: validatorsModel.clone(opts.validators),
      encryption: keypairModel.clone(opts.encryption),
      config: configModel.create(opts.config), // TODO find how to move to clone
      covenantId: covenantIdModel.clone(opts.covenantId),
      binaryIntegrity: binaryModel.clone(opts.binaryIntegrity),
      // timestamp: timestampModel.clone(opts.timestamp),
      acl: aclModel.clone(opts.acl),
      network: networkModel.clone(opts.network),
      state: stateModel.clone(opts.state),
    }
    return dmzModel.clone(dmz)
  },
  logicize: (instance) => {
    // TODO if isSideEffectCapable ensure the validators list is singular
    assert(!instance.state.actions)
    return {}
  },
})

module.exports = { dmzModel }
