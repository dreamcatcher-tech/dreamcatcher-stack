import assert from 'assert-fast'
import { isReplyType } from '../../../w002-api'
import { TxRequest, TxReply, RxRequest, RxReply, Dmz } from '../..'
import { mixin } from '../MapFactory'
const schema = {
  title: 'Reduction',
  type: 'object',
  required: ['isPending'],
  additionalProperties: false,
  properties: {
    // TODO rename reduction to nextState or something
    reduction: { type: 'object' },
    isPending: { type: 'boolean' },
    txReplies: {
      type: 'array',
      uniqueItems: true,
      items: TxReply.schema,
    },
    txRequests: {
      type: 'array',
      items: TxRequest.schema,
    },
  },
}
export class Reduction extends mixin(schema) {
  static create(reduceResolve, origin, dmz) {
    let { reduction, isPending, transmissions, ...rest } = reduceResolve
    assert(!Object.keys(rest).length)
    assert(Array.isArray(transmissions))
    assert(origin instanceof RxRequest || origin instanceof RxReply)
    assert(dmz instanceof Dmz)
    const { txReplies, txRequests } = inflate(transmissions, origin)
    for (const tx of txRequests) {
      if (tx.to === '.@@io') {
        assert(dmz.config.isPierced)
        break
      }
    }
    // TODO reuse dmz models if this is for system state
    const next = { reduction, isPending, txReplies, txRequests }
    if (!reduction) {
      delete next.reduction
    }
    return super.create(next)
  }
  assertLogic() {
    const { reduction, isPending, txReplies, txRequests } = this
    assert((reduction && !isPending) || (!reduction && isPending))
    let promiseCount = 0
    const identifierSet = new Set()
    for (const txReply of txReplies) {
      // check the logic of the group of actions together
      if (txReply.getReply().isPromise()) {
        promiseCount++
      }
      identifierSet.add(txReply.identifier)
    }
    assert(identifierSet.size === txReplies.length, `Duplicate identifier`)
    if (isPending) {
      assert.strictEqual(promiseCount, 0, `No promises allowed if pending`)
    } else {
      assert(promiseCount <= 1, `Max one promise allowed: ${promiseCount}`)
    }
  }
}

const inflate = (transmissions, origin) => {
  const txReplies = []
  const txRequests = []
  for (let tx of transmissions) {
    if (!tx) {
      throw new Error(`Action cannot be interpreted: ${tx}`)
    }
    if (typeof tx === 'string') {
      tx = { type: tx }
    }
    assert(tx.type, `Action must supply a type`)

    if (isReplyType(tx.type)) {
      const { type, payload = {} } = tx
      let identifier = tx.identifier
      if (!identifier) {
        assert(origin instanceof RxRequest)
        identifier = origin.identifier
      }
      const txReply = TxReply.create(type, payload, identifier)
      txReplies.push(txReply)
    } else {
      const { type, payload, to } = tx
      const txRequest = TxRequest.create(type, payload, to)
      txRequests.push(txRequest)
    }
  }
  return { txReplies, txRequests }
}
