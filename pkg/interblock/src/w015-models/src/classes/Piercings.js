import { publicKeySchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { ciKeypair } from '../../../w012-crypto'
export class Piercings extends mixin(publicKeySchema) {}
