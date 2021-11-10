import assert from 'assert-fast'
import { metaModel, rxReplyModel, dmzModel } from '../../w015-models'

const withoutReply = (dmz, rxReply) => {
  assert(dmzModel.isModel(dmz))
  assert(rxReplyModel.isModel(rxReply))
  assert(dmz.meta.isAwaiting(rxReply))
  const meta = { ...dmz.meta, replies: { ...dmz.meta.replies } }
  delete meta.replies[rxReply.identifier]
  return metaModel.clone(meta)
}

const withSlice = (meta, identifier, slice) => {
  assert(metaModel.isModel(meta))
  assert.strictEqual(typeof identifier, 'string')
  assert.strictEqual(typeof slice, 'object')
  const replies = { ...meta.replies, [identifier]: slice }
  return metaModel.clone({ ...meta, replies })
}

export { withoutReply, withSlice }
