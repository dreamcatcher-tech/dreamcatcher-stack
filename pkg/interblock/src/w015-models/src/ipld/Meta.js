import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Meta extends IpldStruct {
  static create() {
    return super.clone({ replies: {} })
  }
  assertLogic() {
    const { replies } = this
    for (const slice of Object.values(replies)) {
      assert.strictEqual(typeof slice.type, 'string', `Must supply type`)
    }
  }
  isAwaiting(reply) {
    assert(reply instanceof RxReply)
    return !!this.replies[reply.identifier]
  }
  getMetaSlice(reply) {
    assert(reply instanceof RxReply)
    assert(this.isAwaiting(reply))
    return this.replies[reply.identifier]
  }
}
