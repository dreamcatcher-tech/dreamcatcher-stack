import { publicKeySchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Meta extends mixin(publicKeySchema) {}
