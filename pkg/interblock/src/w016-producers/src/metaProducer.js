import assert from 'assert-fast'
import { Meta, RxReply, Dmz } from '../../w015-models'

const withoutReply = (dmz, rxReply) => {
  assert(dmz instanceof Dmz)
  assert(rxReply instanceof RxReply)
  assert(dmz.meta.isAwaiting(rxReply))
  const meta = { ...dmz.meta, replies: { ...dmz.meta.replies } }
  delete meta.replies[rxReply.identifier]
  return Meta.clone(meta)
}

const withSlice = (meta, identifier, slice) => {
  assert(meta instanceof Meta)
  assert.strictEqual(typeof identifier, 'string')
  assert.strictEqual(typeof slice, 'object')
  const replies = { ...meta.replies, [identifier]: slice }
  return Meta.clone({ ...meta, replies })
}

export { withoutReply, withSlice }
