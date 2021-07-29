import * as crypto from '../../../w012-crypto'
import { standardize } from '../modelUtils'
import { signatureSchema } from '../schemas/modelSchemas'

const signatureModel = standardize({
  schema: signatureSchema,
  create() {
    throw new Error(`Only the keypairModel can create signatureModel types`)
  },
  logicize(instance) {
    const { integrity, seal, publicKey } = instance
    const { hash } = integrity
    const { key } = publicKey
    if (!crypto.verifyHashSync(hash, seal, key)) {
      const error = new Error(`Could not verify hash synchronously: ${hash}`)
      error.toVerify = { hash, seal, key }
      throw error
    }
    return {}
  },
})

export { signatureModel }
