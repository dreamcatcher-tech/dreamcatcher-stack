import { standardize } from '../../modelUtils'
import { publicKeySchema } from '../../schemas/modelSchemas'

const publicKeyModel = standardize({
  schema: publicKeySchema,
  create() {
    throw new Error(`Only the keypairModel can create publicKeyModel types`)
  },
  logicize(instance) {
    // TODO check format of the key using regex
    // check the encoding of the key
    return {}
  },
})

export { publicKeyModel }
