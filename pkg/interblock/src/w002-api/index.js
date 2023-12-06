import assert from 'assert-fast'
import { Request } from '../w008-ipld/index.mjs'
const hookSymbol = Symbol.for('interblock:api:hook')

const getHook = (hookName) => {
  const globalHook = globalThis[hookSymbol]
  assert(globalHook[hookName], `global hook detached: ${hookName}`)
  return globalHook[hookName]
}

export const interchain = (type, payload, to) =>
  getHook('interchain')(type, payload, to)
export const useState = (path = '.') => getHook('useState')(path)
export const useAI = (path = '.') => getHook('useAI')(path)
export const useApi = (path = '.') => getHook('useApi')(path)
export const useAsync = (...args) => getHook('useAsync')(...args)
export const usePulse = async (path = '.') => {
  assert.strictEqual(typeof path, 'string')
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
    await useState(path)
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
