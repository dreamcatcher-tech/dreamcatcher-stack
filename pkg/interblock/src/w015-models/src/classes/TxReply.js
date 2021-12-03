import { txReplySchema } from '../schemas/transientSchemas'
import { mixin } from './MapFactory'
export class TxReply extends mixin(txReplySchema) {}
