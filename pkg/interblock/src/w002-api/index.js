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
export const useCovenantState = async (path = '.') => {
  const request = Request.createGetCovenantState(path)
  return await interchain(request)
}
