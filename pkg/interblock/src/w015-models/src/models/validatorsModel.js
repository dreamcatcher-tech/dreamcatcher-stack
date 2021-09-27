import { standardize } from '../modelUtils'
import { validatorsSchema } from '../schemas/modelSchemas'
import { keypairModel } from './keypairModel'

const validatorsModel = standardize({
  schema: validatorsSchema,
  create() {
    const ciKeypair = keypairModel.create()
    const entry = ciKeypair.getValidatorEntry()
    return validatorsModel.clone(entry)
  },
  logicize(instance) {
    // TODO validate the keys if using the CI key
    return {}
  },
})

export { validatorsModel }
