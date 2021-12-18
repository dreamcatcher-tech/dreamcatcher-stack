import { signatureSchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import * as crypto from '../../../w012-crypto'

export class Signature extends mixin(signatureSchema) {
  static create({ integrity, seal, publicKey }) {
    return super.create({ integrity, seal, publicKey })
  }
  assertLogic() {
    const { integrity, seal, publicKey } = this
    const { hash } = integrity
    const { key } = publicKey
    if (!crypto.verifyHashSync(hash, seal, key)) {
      const error = new Error(`Could not verify hash synchronously: ${hash}`)
      error.toVerify = { hash, seal, key }
      throw error
    }
  }
}
