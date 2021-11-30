import { publicKeySchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { ciKeypair } from '../../../w012-crypto'
export class Signature extends mixin(publicKeySchema) {}
