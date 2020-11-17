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
const { pendingModel } = require('./pendingModel')
const { rxRequestModel } = require('../transients')

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
    'pending',
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
    pending: pendingModel.schema,
    // TODO add version ?
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
      pending: pendingModel.create(), // cannot start a dmz as pending
    }
    return dmzModel.clone(dmz)
  },
  logicize: (instance) => {
    // TODO if isSideEffectCapable ensure the validators list is singular
    const { network, pending, config } = instance
    // TODO verify that the buffers map to legit channels
    assert(pending.isBufferValid(network))
    assert(!network['@@io'] || config.isPierced)
    const rx = () => {
      const reply = network.rxReply()
      if (reply) {
        return reply
      }
      const bufferedRequest = pending.rxBufferedRequest(network)
      if (!pending.getIsPending() && bufferedRequest) {
        return bufferedRequest
      }
      return network.rxRequest()
    }
    return { rx }
  },
})

module.exports = { dmzModel }
