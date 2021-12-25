import assert from 'assert-fast'
import { Meta, RxReply, Dmz } from '../../w015-models'

const withoutReply = (meta, rxReply) => {
  assert(meta instanceof Meta)
  assert(rxReply instanceof RxReply)
  assert(meta.isAwaiting(rxReply))
  const replies = { ...meta.replies }
  delete replies[rxReply.identifier]
  return meta.update({ replies })
}

const withSlice = (meta, identifier, slice) => {
  assert(meta instanceof Meta)
  assert.strictEqual(typeof identifier, 'string')
  assert.strictEqual(typeof slice, 'object')
  const replies = { ...meta.replies, [identifier]: slice }
  return meta.update({ replies })
}

export { withoutReply, withSlice }
