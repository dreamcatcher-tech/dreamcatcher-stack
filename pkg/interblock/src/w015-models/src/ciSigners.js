import { assert } from 'chai/index.mjs'
import { keypairModel } from './models/keypairModel' // TODO do not import across folder boundaries
// maybe move ciSigners to be inside the models folder
import { integrityModel } from './models/integrityModel'
import * as crypto from '../../w012-crypto'

export const pierceKeypair = keypairModel.create('PIERCE', crypto.pierceKeypair) // if they can inject blocks into our ram, we are already pwnt.
export const ciKeypair = keypairModel.create() // defaults: 'CI', crypto.ciKeypair

export const ciSigner = (integrity) => {
  assert(integrityModel.isModel(integrity))
  // TODO maybe don't sign for real in CI ?
  return ciKeypair.sign(integrity)
}

export const pierceSigner = (integrity) => {
  assert(integrityModel.isModel(integrity))
  // TODO insert fake signature here
  return pierceKeypair.sign(integrity)
}

// TODO export genesis signer ?
export const genesisSigner = (integrity) => {
  assert(integrityModel.isModel(integrity))
  // TODO insert fake signature here
  return pierceKeypair.sign(integrity)
}
