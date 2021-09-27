import { assert } from 'chai/index.mjs'
import { addressModel } from '../models/addressModel'
const splitSequence = (sequence) => {
  assert(typeof sequence === 'string')
  const [hash, indexString] = sequence.split('_')
  const index = parseInt(indexString)
  let address
  if (hash === 'LOOPBACK') {
    address = addressModel.create('LOOPBACK')
  } else {
    // TODO use regex for chainId
    address = addressModel.create(hash)
    assert(address.isResolved())
  }
  return { address, index }
}

export { splitSequence }