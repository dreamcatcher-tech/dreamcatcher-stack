import assert from 'assert-fast'
import { Address } from '../classes'

const splitSequence = (identifier) => {
  assert.strictEqual(typeof identifier, 'string')
  // TODO use regex to ensure format
  const [chainId, sHeight, sIndex] = identifier.split('_')
  const height = parseInt(sHeight)
  const index = parseInt(sIndex)
  let address
  if (chainId === 'LOOPBACK') {
    address = Address.create('LOOPBACK')
  } else {
    address = Address.create(chainId)
    assert(address.isResolved())
  }
  return { address, height, index }
}

export { splitSequence }
