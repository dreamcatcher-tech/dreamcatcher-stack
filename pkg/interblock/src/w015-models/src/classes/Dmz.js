import assert from 'assert-fast'
import * as schemas from '../schemas/modelSchemas'
import {
  Validators,
  Keypair,
  Config,
  CovenantId,
  Binary,
  Timestamp,
  Acl,
  Network,
  State,
  Meta,
  Pending,
  Piercings,
} from '.'
import { mixin, Base } from '../MapFactory'
const schema = {
  type: 'object',
  title: 'Dmz',
  description: `DMZ coordinates all the models in one place.
    Dmz is equivalent to CombineReducers in Redux.
    "meta" is a state slice for use by the dmz to track outstanding promises`,
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
    validators: Validators.schema,
    encryption: Keypair.schema,
    config: Config.schema,
    covenantId: CovenantId.schema,
    binary: Binary.schema,
    timestamp: Timestamp.schema,
    acl: Acl.schema,
    network: Network.schema, // grows and churns slowly
    state: State.schema, // wildcard
    meta: Meta.schema, // high churn
    pending: Pending.schema, // grows
    piercings: Piercings.schema, // transient
    // TODO add version ?
  },
}

const defaultParams = {
  validators: Validators.create(),
  encryption: Keypair.create(),
  config: Config.create(),
  covenantId: CovenantId.create(),
  binary: Binary.create(),
  timestamp: Timestamp.create(),
  acl: Acl.create(),
  network: Network.create(), // grows and churns slowly
  state: State.create(), // wildcard
  meta: Meta.create(), // high churn
  pending: Pending.create(), // grows
}

export class Dmz extends mixin(schema) {
  static create(params = {}) {
    assert.strictEqual(typeof params, 'object')
    params = { ...params }
    if (params.validators) {
      params.validators = Validators.create(params.validators)
    }
    for (const key in params) {
      if (params[key] instanceof Base) {
        continue
      }
      assert.strictEqual(typeof params[key], 'object')
      params[key] = defaultParams[key].update(params[key])
    }
    if (!params.timestamp) {
      params.timestamp = Timestamp.create()
    }

    const fullParams = { ...defaultParams, ...params }
    return super.create(fullParams)
  }
  assertLogic() {
    // TODO if isSideEffectCapable ensure the validators list is singular
    const { network, piercings, config } = this
    // TODO verify that the buffers map to legit channels
    assert(!network.has('.@@io') || config.isPierced)
    assert(!piercings || config.isPierced)
  }
  isTransmitting() {
    return this.network.isTransmitting()
  }
  getCurrentHeight() {
    const loopback = this.network.get('.')
    if (!Number.isInteger(loopback.tipHeight)) {
      // it is not possible to be running the accumulator at height 0
      return 1
    }
    return loopback.tipHeight + 1
  }
}
