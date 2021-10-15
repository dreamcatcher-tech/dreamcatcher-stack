import assert from 'assert-fast'
import { addressModel } from '../models/addressModel'

const splitSequence = (sequence) => {
  assert(typeof sequence === 'string')
  // TODO use regex to ensure format
  const [chainId, sHeight, sIndex] = sequence.split('_')
  const height = parseInt(sHeight)
  const index = parseInt(sIndex)
  let address
  if (chainId === 'LOOPBACK') {
    address = addressModel.create('LOOPBACK')
  } else {
    address = addressModel.create(chainId)
    assert(address.isResolved())
  }
  return { address, height, index }
}

export { splitSequence }
