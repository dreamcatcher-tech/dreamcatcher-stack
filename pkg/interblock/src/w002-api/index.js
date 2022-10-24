import assert from 'assert-fast'
import { Request } from '../w008-ipld'

export const interchain = (type, payload, to) => {
  const { interchain } = globalThis[Symbol.for('interblock:api:hook')]
  assert(interchain, `global hook detached`)
  return interchain(type, payload, to)
}
export const useState = (path = '.') => {
  const { useState } = globalThis[Symbol.for('interblock:api:hook')]
  assert(useState, `global hook detached`)
  return useState(path)
}
export const usePulse = async (path = '.') => {
  assert.strictEqual(typeof path, 'string')
  assert(path)
  const reply = interchain('@@USE_PULSE', { path })
  return reply
}

export const isApiAction = (request, covenant) => {
  assert.strictEqual(typeof request, 'object')
  assert.strictEqual(typeof request.type, 'string')
  assert(request.type)
  assert.strictEqual(typeof covenant, 'object')
  assert.strictEqual(typeof covenant.api, 'object')
  const schemas = Object.values(covenant.api)
  assert(schemas.length, 'No actions in schema')
  assert(schemas.every((schema) => typeof schema.title === 'string'))
  return schemas.some(({ title }) => request.type === title)
}

export const ensureChild = async (path, installer = 'unity') => {
  assert.strictEqual(typeof path, 'string')
  assert(path)
  // TODO assert child points to a deeper path, not higher one
  if (typeof installer === 'string') {
    installer = { covenant: installer }
  }
  assert.strictEqual(typeof installer, 'object')
  try {
    await interchain(Request.tryPath(path))
    // TODO assert covenant matches
  } catch (error) {
    // TODO work with any child
    const msg = `Segment not present: /.mtab of: .mtab`
    if (error.message !== msg) {
      throw error
    }
    const spawnAction = Request.createSpawn(path, installer)
    await interchain(spawnAction)
  }
}

export const isSystemAction = (request) => {
  assert.strictEqual(typeof request.type, 'string')
  return Request.SYSTEM_TYPES.includes(request.type)
}

export { schemaToFunctions } from './schemaToFunctions'
