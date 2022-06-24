import assert from 'assert-fast'

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
export const useBlocks = (path = '.') => {
  assert.strictEqual(typeof path, 'string')
  return interchain('@@USE_BLOCKS', { path })
}
/**
 * End the current block, and immediately begin executing againt.
 * Different to useTimeout(0) only because of the action name.
 */
const useBlockBuster = async () => {}

/**
 * Break the current block, then return after at least delayMs milliseconds
 */
const useTimeout = async (delayMs = 0) => {}
