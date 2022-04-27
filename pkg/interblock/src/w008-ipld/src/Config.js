import { IpldStruct } from './IpldStruct'
/**
 type SideEffectsConfig struct {
    networkAccess [String]
    asyncTimeoutMs Int
}
type Entropy struct {
    seed String
    count Int
}
type Config struct {
    isPierced Bool
    sideEffects SideEffectsConfig
    isPublicChannelOpen Bool    # May be list of approots
    acl &ACL
    interpulse &Covenant        # What version of Interpulse is this built for
    entropy Entropy
    covenant &Covenant
}
 */
export class Config extends IpldStruct {
  static createPierced() {
    const instance = Config.create()
    return instance.setMap({ isPierced: true })
  }
  static create(opts = {}) {
    const sideEffects = { networkPatterns: [''], asyncTimeoutMs: 0 }
    opts = { ...opts, sideEffects: { ...sideEffects, ...opts.sideEffects } }
    const config = {
      isPierced: false,
      sideEffects,
      isPublicChannelOpen: false,
    }
    return super.clone({ ...config, ...opts })
  }
  assertLogic() {
    // TODO check that if no async, network is also disabled
  }
}
