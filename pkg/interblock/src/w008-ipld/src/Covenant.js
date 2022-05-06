import { IpldStruct } from './IpldStruct'

export class LiveCovenant {}

export class Covenant extends IpldStruct {
  payloads = {
    ACTION_TYPE: {
      type: 'object',
    },
    // json schema for actions
  }
  get actions() {
    // makes functions that run a schema check then
    return {
      ACTION_TYPE: (payload = {}) => ({ type: 'ACTION_TYPE', payload }),
    }
  }
  static createDev() {
    // make a dev mode covenant ?
  }
}
