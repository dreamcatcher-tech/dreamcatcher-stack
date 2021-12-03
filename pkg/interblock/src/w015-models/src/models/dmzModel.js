import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { covenantIdModel } from './covenantIdModel'
import { timestampModel } from './converted/timestampModel'
import { keypairModel } from './converted/keypairModel'
import { aclModel } from './aclModel'
import { binaryModel } from './binaryModel'
import { networkModel } from './converted/networkModel'
import { stateModel } from './converted/stateModel'
import { metaModel } from './converted/metaModel'
import { configModel } from './configModel'
import { validatorsModel } from './converted/validatorsModel'
import { pendingModel } from './converted/pendingModel'
import { piercingsModel } from './converted/piercingsModel'

const schema = {
  type: 'object',
  title: 'Dmz',
  //   description: `DMZ coordinates all the models in one place.
  // Dmz is equivalent to CombineReducers in Redux.
  // "meta" is a state slice for use by the dmz to track outstanding promises`,
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
    'meta',
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
    network: networkModel.schema, // grows
    state: stateModel.schema, // wildcard
    meta: metaModel.schema, // high churn
    pending: pendingModel.schema, // grows
    piercings: piercingsModel.schema, // transient
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
      meta: metaModel.clone(opts.meta), // stores dmz state
      pending: pendingModel.create(), // cannot start a dmz as pending
    }
    return dmzModel.clone(dmz)
  },
  logicize: (instance) => {
    // TODO if isSideEffectCapable ensure the validators list is singular
    const { network, pending, config } = instance
    // TODO verify that the buffers map to legit channels
    assert(!network['.@@io'] || config.isPierced)
    assert(!instance.piercings || config.isPierced)
    const isTransmitting = () => {
      const aliases = instance.network.getAliases()
      for (const alias of aliases) {
        const channel = instance.network[alias]
        if (channel.isTransmitting()) {
          return true
        }
      }
      return false
    }
    const getCurrentHeight = () => {
      if (!Number.isInteger(network['.'].tipHeight)) {
        // it is not possible to be running the accumulator at height 0
        return 1
      }
      return network['.'].tipHeight + 1
    }
    return { isTransmitting, getCurrentHeight }
  },
})

export { dmzModel }
