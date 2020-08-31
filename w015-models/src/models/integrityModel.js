const assert = require('assert')
const debug = require('debug')('interblock:models:integrity')
const crypto = require('../../../w012-crypto')
const { standardize } = require('../utils')
const { integritySchema } = require('../schemas/modelSchemas')

const integrityModel = standardize({
  schema: integritySchema,
  create(content) {
    // TODO force content to be either a model, or a string, or undefined
    if (!content || content === 'UNKNOWN') {
      return integrityModel.clone({
        hash: 'UNKNOWN',
        algorithm: 'sha256',
      })
    }
    if (typeof content === 'string') {
      content = { string: content }
    }
    assert(typeof content === 'object', `Must supply object: ${content}`)
    const integrity = {
      hash: crypto.objectHash(content),
      algorithm: 'sha256',
    }
    const clone = integrityModel.clone(integrity)
    return clone
  },
  logicize(instance) {
    // TODO check the format of the hash string using regex
    const isUnknown = () => instance.hash === 'UNKNOWN'
    const isIntegrityMatch = (content) => {
      const copy = integrityModel.create(content)
      return copy.hash === instance.hash
    }
    return { isUnknown, isIntegrityMatch }
  },
})
module.exports = { integrityModel }
