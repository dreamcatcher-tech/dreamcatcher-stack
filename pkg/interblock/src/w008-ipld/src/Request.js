import assert from 'assert-fast'
import { assertNoUndefined } from './utils'
import equals from 'fast-deep-equal'
import { IpldStruct } from './IpldStruct'
import { PulseLink, Binary } from '.'
import schemas from '../../w006-schemas'

export class Request extends IpldStruct {
  static create(request, payload = {}, binary) {
    // TODO this should use the schema of the target
    if (typeof request === 'undefined') {
      throw new Error(`Actions cannot be undefined`)
    }
    if (typeof request === 'string') {
      request = { type: request, payload }
    }
    if (!request.payload) {
      request = { ...request, payload: {} }
    }
    payload = request.payload
    assertNoUndefined(payload)
    const stringified = JSON.stringify(payload, null, 2)
    const cloned = JSON.parse(stringified)
    assert(equals(payload, cloned), `payload not POJO ${stringified}`)
    if (binary) {
      request = { ...request, binary }
    }
    if (request.binary) {
      assert(binary instanceof Binary)
    }
    return super.clone(request)
  }
  static classMap = { binary: Binary }
  static get schema() {
    return schemas.types.Action
  }
  static SYSTEM_TYPES = [
    '@@PING',
    '@@SPAWN',
    '@@ADD_CHILD',
    '@@INSERT_FORK',
    '@@GENESIS',
    '@@CONNECT',
    '@@UPLINK',
    '@@INTRO',
    '@@ACCEPT',
    '@@OPEN_PATH',
    '@@OPEN_CHILD',
    '@@DEPLOY',
    '@@INSTALL',
    '@@GET_STATE',
    '@@SET_STATE',
    '@@GET_SCHEMA',
    '@@SET_SCHEMA',
    '@@GET_AI',
    '@@SET_AI',
    '@@USE_PULSE',
    '@@SELF_ID',
    '@@RESOLVE_DOWNLINK',
    '@@INVALIDATE',
    '@@GET_ADDRESS',
    '@@MOUNT',
    '@@LN',
    '@@HARDLINK',
    '@@COVENANT', // TODO remove this when can usePulse()
    '@@API', // TODO remove this when can usePulse()
    '@@RM',
    '@@SET_SUB', // TODO installers should allow an init array
    '@@CONFIG',
    '@@LS',
  ]
  isSystem() {
    return Request.SYSTEM_TYPES.includes(this.type)
  }
  static PULSE_TYPES = ['@@USE_PULSE']
  isPulse() {
    return Request.PULSE_TYPES.includes(this.type)
  }
  static createGetState(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    return this.create('@@GET_STATE', { path })
  }
  static createSetState(changes, binary, replace) {
    assert.strictEqual(typeof changes, 'object')
    return this.create('@@SET_STATE', { changes, replace }, binary)
  }
  static createGetSchema(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    return this.create('@@GET_SCHEMA', { path })
  }
  static createSetSchema(schema) {
    assert.strictEqual(typeof schema, 'object')
    return this.create('@@SET_SCHEMA', { schema })
  }
  static createGetAI(path) {
    // TODO maybe we could make a generic slice getter for any key in pulse ?
    assert.strictEqual(typeof path, 'string')
    assert(path)
    return this.create('@@GET_AI', { path })
  }
  static createSetAI(ai, binary) {
    assert.strictEqual(typeof ai, 'object')
    return this.create('@@SET_AI', { ai }, binary)
  }
  static createSpawn(alias, installer = {}) {
    const payload = { alias, installer }
    if (!alias) {
      delete payload.alias
    }
    return this.create('@@SPAWN', payload)
  }
  static createAddChild(alias, installer) {
    return {
      type: '@@ADD_CHILD',
      payload: { alias, installer },
    }
  }
  static createPing(payload) {
    if (typeof payload === 'string') {
      payload = { string: payload }
    }
    return this.create('@@PING', payload)
  }
  static createOpenPath(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    return this.create('@@OPEN_PATH', { path })
  }
  static createMount(chainId, name) {
    assert.strictEqual(typeof chainId, 'string')
    const payload = { chainId }
    if (name) {
      assert.strictEqual(typeof name, 'string')
      payload.name = name
    }
    return this.create('@@MOUNT', payload)
  }
  static createLn(target, linkName) {
    assert.strictEqual(typeof target, 'string')
    const payload = { target }
    if (linkName) {
      assert.strictEqual(typeof linkName, 'string')
      payload.linkName = linkName
    }
    return this.create('@@LN', payload)
  }
  static createHardlink(name, chainId) {
    assert.strictEqual(typeof name, 'string')
    assert(name)
    assert.strictEqual(typeof chainId, 'string')
    return this.create('@@HARDLINK', { name, chainId })
  }
  static createUsePulse(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    return this.create('@@USE_PULSE', { path })
  }
  // TODO move all these to use the dmzReducers api in a schema
  static createInsertFork(pulseId, name) {
    assert.strictEqual(typeof pulseId, 'string')
    assert(PulseLink.parse(pulseId))
    return this.create('@@INSERT_FORK', { pulseId, name })
  }
  static createRemoveActor(path) {
    assert.strictEqual(typeof path, 'string', `path must be a string`)
    assert(path, `path must not be empty`)
    return this.create('@@RM', { path })
  }
  static createSetSubscription(path, status) {
    assert.strictEqual(typeof path, 'string', `path must be a string`)
    assert(path, `path must not be empty`)
    return this.create('@@SET_SUB', { path, status })
  }
  static createTreeUpdate(prior, latest) {
    assert(latest instanceof PulseLink)
    const payload = { latest: latest.toString() }
    if (prior) {
      assert(prior instanceof PulseLink)
      payload.prior = prior.toString()
    }
    return this.create('@@TREE_UPDATE', payload)
  }
}
