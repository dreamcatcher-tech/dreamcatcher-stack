import assert from 'assert-fast'

export class Timestamp {
  static create(now = new Date()) {
    assert(now instanceof Date)
    // '2011-10-05T14:48:00.000Z'
    const isoDate = now.toISOString()
    const instance = new this.constructor()
    instance.isoDate = isoDate
    return instance
  }
  isExpired(expiresAfterMs) {
    throw new Error('not implemented')
    // const now = Date.now()
    // const msElapsed = now - this.ms
    // return msElapsed >= expiresAfterMs
  }
}
