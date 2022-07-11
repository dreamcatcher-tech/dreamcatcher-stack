import { IpldStruct } from './IpldStruct'
import { sha256 } from 'multiformats/hashes/sha2'
import { fromString as from } from 'uint8arrays/from-string'
import { toString as to } from 'uint8arrays/to-string'
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
      covenant: 'unity', // TODO hashlock to unity
    }
    return super.clone({ ...config, ...opts })
  }
  assertLogic() {
    // TODO check that if no async, network is also disabled
  }
  async increaseEntropy() {
    // TODO inject something unique to the block here, so cannot
    // predict if you had a single example, such as the blockhash
    let { entropy = '0123456789abcdef' } = this
    const { bytes } = await sha256.digest(from(entropy, 'base64'))
    entropy = to(bytes, 'base64')
    return this.setMap({ entropy })
  }
}
