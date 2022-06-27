import assert from 'assert-fast'
import { assertNoUndefined } from './utils'
import equals from 'fast-deep-equal'
import { IpldStruct } from './IpldStruct'
import { Binary } from '.'
import schemas from '../../w006-schemas'

export class Request extends IpldStruct {
  static create(request, payload = {}, binary) {
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
    '@@GENESIS',
    '@@CONNECT',
    '@@UPLINK',
    '@@INTRO',
    '@@ACCEPT',
    '@@OPEN_CHILD',
    '@@DEPLOY',
    '@@INSTALL',
  ]
  isSystem() {
    return Request.SYSTEM_TYPES.includes(this.type)
  }
  static createGetState(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    return this.create('@@GET_STATE', { path })
  }
  static createSetState(state, binary) {
    assert.strictEqual(typeof state, 'object')
    return this.create('@@SET_STATE', { state }, binary)
  }
  static createSpawn(alias, spawnOptions = {}) {
    const payload = { alias, spawnOptions }
    if (!alias) {
      delete payload.alias
    }
    return this.create('@@SPAWN', payload)
  }
}
