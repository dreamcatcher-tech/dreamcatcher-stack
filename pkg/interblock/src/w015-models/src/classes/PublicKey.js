import { publicKeySchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import { ciKeypair } from '../../../w012-crypto'
export class PublicKey extends mixin(publicKeySchema) {
  static ci() {
    const params = { key: ciKeypair.publicKey, algorithm: 'noble-secp256k1' }
    return PublicKey.create(params)
  }
}
