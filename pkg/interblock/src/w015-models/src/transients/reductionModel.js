import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { txRequestModel } from './txRequestModel'
import { txReplyModel } from './txReplyModel'
import { rxReplyModel } from './rxReplyModel'
import { rxRequestModel } from './rxRequestModel'
import { registry } from '../registry' // handles circular reference to dmzmodel

const _inflate = (action, defaultAction) => {
  if (!action) {
    throw new Error(`Action cannot be interpreted: ${action}`)
  }
  if (typeof action === 'string') {
    action = { type: action }
  }
  assert(action.type, `Action must supply a type`)

  if (_isReply(action.type)) {
    const { type, payload = {} } = action
    let { request } = action
    let identifier
    if (request) {
      identifier = request.identifier
    } else {
      assert(rxRequestModel.isModel(defaultAction))
      identifier = defaultAction.identifier
    }
    return txReplyModel.create(type, payload, identifier)
  } else {
    const { type, payload = {}, to = '.' } = action
    return txRequestModel.create(type, payload, to)
  }
}

const _isReply = (type) =>
  txReplyModel.schema.properties.type.enum.includes(type)

const reductionModel = standardize({
  schema: {
    title: 'Reduction',
    type: 'object',
    required: ['isPending'],
    additionalProperties: false,
    properties: {
      reduction: { type: 'object' },
      isPending: { type: 'boolean' },
      transmissions: {
        type: 'array',
        uniqueItems: true,
        items: { oneOf: [txRequestModel.schema, txReplyModel.schema] },
      },
    },
  },
  create(reduceResolve, origin, dmz) {
    // TODO resolve circular reference problem
    let { reduction, isPending, transmissions, ...rest } = reduceResolve
    assert(!Object.keys(rest).length)
    assert(Array.isArray(transmissions))
    assert(rxRequestModel.isModel(origin) || rxReplyModel.isModel(origin))
    const dmzModel = registry.get('Dmz')
    assert(dmzModel.isModel(dmz))
    transmissions = transmissions.map((request) => _inflate(request, origin))
    transmissions.forEach((txRequest) => {
      if (txRequest.to === '.@@io') {
        assert(dmz.config.isPierced)
      }
    })
    // TODO check replies are to real actions
    // TODO reuse dmz models if this is for system state
    const obj = { reduction, isPending, transmissions }
    if (!reduction) {
      delete obj.reduction
    }
    return reductionModel.clone(obj)
  },
  logicize(instance) {
    const { reduction, isPending, transmissions } = instance
    assert((reduction && !isPending) || (!reduction && isPending))
    const replies = transmissions.filter(txReplyModel.isModel)
    const requests = transmissions.filter(txRequestModel.isModel)
    assert.strictEqual(transmissions.length, requests.length + replies.length)
    Object.freeze(replies)
    Object.freeze(requests)

    for (const tx of transmissions) {
      assert(txRequestModel.isModel(tx) || txReplyModel.isModel(tx))
    }
    let promiseCount = 0
    const identifierSet = new Set()
    replies.forEach((txReply) => {
      // check the logic of the group of actions together
      if (txReply.getReply().isPromise()) {
        promiseCount++
      }
      identifierSet.add(txReply.identifier)
    })

    assert(identifierSet.size === replies.length, `Duplicate identifier`)
    if (isPending) {
      assert.strictEqual(promiseCount, 0, `No promises allowed if pending`)
    } else {
      assert(promiseCount <= 1, `Max one promise allowed: ${promiseCount}`)
    }
    const getIsPending = () => isPending
    const getReplies = () => replies
    return { getIsPending, getReplies }
  },
})

export { reductionModel }
