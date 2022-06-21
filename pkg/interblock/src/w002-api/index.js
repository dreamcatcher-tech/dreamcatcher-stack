import assert from 'assert-fast'

export const interchain = (type, payload, to) => {
  const { interchain } = globalThis[Symbol.for('interblock:api:hook')]
  assert(interchain, `global hook detached`)
  return interchain(type, payload, to)
}
