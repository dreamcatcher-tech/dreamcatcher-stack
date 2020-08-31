const { standardize } = require('../utils')
const { validatorsSchema } = require('../schemas/modelSchemas')
const { publicKeyModel } = require('./publicKeyModel')
const { keypairModel, ciKeypair } = require('./keypairModel')

const validatorsModel = standardize({
  schema: validatorsSchema,
  create() {
    const keypair = keypairModel.create('CI', ciKeypair)
    // TODO move asynchrony to the caller ?
    const entry = keypair.getValidatorEntry()
    return validatorsModel.clone(entry)
  },
  logicize(instance) {
    // TODO validate the keys if using the CI key
    return {}
  },
})

module.exports = { validatorsModel }
