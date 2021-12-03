import { signatureSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Signature extends mixin(signatureSchema) {
  static create() {
    throw new Error(`Only Keypair can create Signatures`)
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
