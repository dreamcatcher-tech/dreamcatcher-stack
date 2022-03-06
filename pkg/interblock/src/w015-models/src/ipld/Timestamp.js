import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Timestamp extends IpldStruct {
  static create(now = new Date()) {
    assert(now instanceof Date)
    // '2011-10-05T14:48:00.000Z'
    const isoDate = now.toISOString()
    return super.create({ isoDate })
  }
  isExpired(expiresAfterMs) {
    throw new Error('not implemented')
    // const now = Date.now()
    // const msElapsed = now - this.ms
    // return msElapsed >= expiresAfterMs
  }
}
