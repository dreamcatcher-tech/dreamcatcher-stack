import { interblockSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { ciKeypair } from '../../../w012-crypto'
export class Interblock extends mixin(interblockSchema) {}
