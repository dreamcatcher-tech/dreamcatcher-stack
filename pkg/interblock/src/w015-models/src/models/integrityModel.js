import { assert } from 'chai/index.mjs'
import * as crypto from '../../../w012-crypto'
import { standardize } from '../modelUtils'
import { integritySchema } from '../schemas/modelSchemas'
import Debug from 'debug'
const debug = Debug('interblock:models:integrity')

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
    if (typeof content === 'string' && content.length === 64) {
      // TODO do regex to test hashlikeness
      return integrityModel.clone({ hash: content, algorithm: 'sha256' })
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
export { integrityModel }
