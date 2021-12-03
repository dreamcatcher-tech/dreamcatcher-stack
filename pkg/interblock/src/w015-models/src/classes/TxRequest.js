import { txRequestSchema } from '../schemas/transientSchemas'
import { mixin } from './MapFactory'
export class TxRequest extends mixin(txRequestSchema) {}
