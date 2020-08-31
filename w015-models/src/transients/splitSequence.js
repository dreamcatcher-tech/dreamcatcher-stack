const assert = require('assert')
const { addressModel } = require('../models/addressModel')
const { integrityModel } = require('../models/integrityModel')
const splitSequence = (sequence) => {
  assert(typeof sequence === 'string')
  const [hash, indexString] = sequence.split('_')
  const index = parseInt(indexString)
  let address
  if (hash === 'LOOPBACK') {
    address = addressModel.create('LOOPBACK')
  } else {
    const integrity = integrityModel.clone({
      ...integrityModel.clone(),
      hash,
    })
    address = addressModel.create(integrity)
  }
  return { address, index }
}

module.exports = splitSequence
