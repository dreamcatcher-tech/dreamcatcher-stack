import assert from 'assert-fast'

export * from './src/api'
export * from './src/queries'
export const interchain = (type, payload, to) => {
  const { interchain } = globalThis[Symbol.for('interblock:api:hook')]
  assert(interchain, `global hook detached`)
  return interchain(type, payload, to)
}
/**
 * Respond to the current request with a complex payload.
 * Rejections are communicated by throwing.
 * There is only one response allowed per thread.
 * @param {*} payload
 * @param {*} binary
 * @returns
 */
export const respond = (payload, binary) => {
  const { respond } = globalThis[Symbol.for('interblock:api:hook')]
  assert(respond, `global hook detached`)
  return respond(payload, binary)
}
