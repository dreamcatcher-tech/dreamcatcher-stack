import { publicKeySchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { ciKeypair } from '../../../w012-crypto'
export class Timestamp extends mixin(publicKeySchema) {}
