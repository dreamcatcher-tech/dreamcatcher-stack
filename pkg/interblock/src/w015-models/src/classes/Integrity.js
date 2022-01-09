import assert from 'assert-fast'
import * as crypto from '../../../w012-crypto'
import { integritySchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'

export class Integrity extends mixin(integritySchema) {
  static create(content) {
    // TODO force content to be either a model, or a string, or undefined
    if (!content || content === 'UNKNOWN') {
      return super.create({ hash: 'UNKNOWN', algorithm: 'sha256' })
    }
    if (typeof content === 'string' && content.length === 64) {
      // TODO do regex to test hashlikeness
      return super.create({ hash: content, algorithm: 'sha256' })
    }
    if (typeof content === 'string') {
      const hash = crypto.bytesToHex(crypto.sha256(content))
      return super.create({ hash, algorithm: 'sha256' })
    }
    assert(typeof content === 'object', `Must supply object: ${content}`)
    if (typeof content.hashString === 'function') {
      const hash = content.hashString() // TODO regex format
      return super.create({ hash, algorithm: 'sha256' })
    }
    const integrity = {
      hash: crypto.objectHash(content),
      algorithm: 'sha256',
    }
    return super.create(integrity)
  }
  assertLogic() {
    // TODO check the format of the hash string using regex
  }
  isUnknown() {
    return this.hash === 'UNKNOWN'
  }
  isIntegrityMatch(content) {
    const copy = Integrity.create(content)
    return copy.hash === this.hash
  }
  hashString() {
    // overrides the prototype function
    return this.hash
  }
}
