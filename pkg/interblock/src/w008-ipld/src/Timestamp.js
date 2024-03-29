import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Timestamp {
  static createCI() {
    return this.create(new Date('2022-02-22T02:22:22.222Z'))
  }
  static create(now = new Date()) {
    assert(now instanceof Date)
    // '2011-10-05T14:48:00.000Z'
    const isoDate = now.toISOString()
    const instance = new Timestamp()
    instance.isoDate = isoDate
    return instance
  }
  isExpired(expiresAfterMs) {
    throw new Error('not implemented')
    // const now = Date.now()
    // const msElapsed = now - this.ms
    // return msElapsed >= expiresAfterMs
  }
  static uncrush(value) {
    const instance = new this()
    instance.isoDate = value.isoDate
    // TODO assert date format is correct
    return instance
  }
}
