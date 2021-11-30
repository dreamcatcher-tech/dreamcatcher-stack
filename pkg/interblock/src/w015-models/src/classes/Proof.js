import { proofSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Proof extends mixin(proofSchema) {}
