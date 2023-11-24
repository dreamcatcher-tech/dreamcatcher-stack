import assert from 'assert-fast'
import { Request } from '../w008-ipld/index.mjs'
const hookSymbol = Symbol.for('interblock:api:hook')
export const interchain = (type, payload, to) => {
  const { interchain } = globalThis[hookSymbol]
  assert(interchain, `global hook detached`)
  return interchain(type, payload, to)
}
export const useState = (path = '.') => {
  const { useState } = globalThis[hookSymbol]
  assert(useState, `global hook detached`)
  return useState(path)
}
export const useAI = (path = '.') => {
  const { useAI } = globalThis[hookSymbol]
  assert(useAI, `global hook detached`)
  return useAI(path)
}
export const useAsync = (...args) => {
  const { useAsync } = globalThis[hookSymbol]
  assert(useAsync, 'global hook detached')
  return useAsync(...args)
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
    if (!error.message.startsWith(`Segment not present: `)) {
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

export { schemaToFunctions } from './src/schemaToFunctions'

export { Request }
