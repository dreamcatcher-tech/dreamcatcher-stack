import assert from 'assert-fast'
import { RxReply } from '.'
import { mixin } from '../MapFactory'
const schema = {
  title: 'Meta',
  type: 'object',
  required: ['replies'],
  // TODO identifier regex for replies
  properties: { replies: { type: 'object' }, deploy: { type: 'object' } },
  additionalProperties: false,
}

export class Meta extends mixin(schema) {
  static create() {
    return super.create({ replies: {} })
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
