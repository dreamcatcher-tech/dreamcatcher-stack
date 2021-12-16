import assert from 'assert-fast'
import { Signature, Integrity, Keypair } from '../../w015-models'
import * as crypto from '../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:producers:signature')

const sign = async (integrity, keypair) => {
  assert(integrity instanceof Integrity)
  assert(!integrity.isUnknown())
  assert(keypair instanceof Keypair)
  debug(`sign`)
  const { hash } = integrity
  const { secretKey, publicKey } = keypair
  // async due to using subtle crypto hmac
  const { signature: seal } = await crypto.signHash(
    hash,
    secretKey,
    publicKey.key
  )
  // TODO find a cleaner way to use publicKey objects, and publicKey strings in crypto
  const model = Signature.clone({ publicKey, integrity, seal })
  debug(`sign complete`)
  return model
}

export { sign }
