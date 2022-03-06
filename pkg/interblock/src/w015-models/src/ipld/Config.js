import { IpldStruct } from './IpldStruct'

export class Config extends IpldStruct {
  static create(opts = {}) {
    const sideEffects = { networkPatterns: [''], asyncTimeoutMs: 0 }
    opts = { ...opts, sideEffects: { ...sideEffects, ...opts.sideEffects } }
    const config = {
      isPierced: false,
      sideEffects,
      isPublicChannelOpen: false,
    }
    return super.create({ ...config, ...opts })
  }
  assertLogic() {
    // TODO check that if no async, network is also disabled
  }
}
