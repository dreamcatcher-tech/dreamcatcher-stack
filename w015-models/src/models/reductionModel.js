const assert = require('assert')
const { standardize } = require('../utils')
const { assertNoUndefined } = require('../assertNoUndefined')
const { txRequestModel } = require('../transients/txRequestModel')
const { txReplyModel } = require('../transients/txReplyModel')
const { rxReplyModel } = require('../transients/rxReplyModel')
const { rxRequestModel } = require('../transients/rxRequestModel')

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
    let sequence
    if (request) {
      sequence = request.sequence
    } else {
      assert(rxRequestModel.isModel(defaultAction))
      sequence = defaultAction.sequence
    }
    return txReplyModel.create(type, payload, sequence)
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
    required: ['isPending', 'requests', 'replies'],
    additionalProperties: false,
    properties: {
      reduction: { type: 'object' },
      isPending: { type: 'boolean' },
      requests: {
        type: 'array',
        uniqueItems: true,
        items: txRequestModel.schema,
      },
      replies: {
        type: 'array',
        uniqueItems: true,
        items: txReplyModel.schema,
      },
    },
  },
  create(reduceResolve, origin) {
    let { reduction, isPending, requests, replies } = reduceResolve
    assert(Array.isArray(requests))
    assert(Array.isArray(replies))
    assert(rxRequestModel.isModel(origin) || rxReplyModel.isModel(origin))
    requests = requests.map((request) => _inflate(request, origin))
    replies = replies.map((reply) => _inflate(reply, origin))
    // TODO reuse dmz models if this is for system state
    const obj = { reduction, isPending, requests, replies }
    if (!reduction) {
      delete obj.reduction
    }
    return reductionModel.clone(obj)
  },
  logicize(instance) {
    const { reduction, isPending, requests, replies } = instance
    assert((reduction && !isPending) || (!reduction && isPending))
    assertNoUndefined(requests, replies)
    if (reduction) {
      assertNoUndefined(reduction)
    }
    let promiseCount = 0
    const sequenceSet = new Set()
    replies.forEach((txReply) => {
      // check the logic of the group of actions together
      if (txReply.getReply().isPromise()) {
        promiseCount++
      }
      sequenceSet.add(txReply.request.sequence)
    })
    if (isPending) {
      assert.strictEqual(promiseCount, 0, `No promises allowed if pending`)
    } else {
      assert(promiseCount <= 1, `Max one promise allowed: ${promiseCount}`)
    }
    assert(sequenceSet.size === replies.length, `Duplicate sequence detected`)
    Object.freeze(requests)
    Object.freeze(replies)
    const getIsPending = () => isPending
    return { getIsPending }
  },
})

module.exports = { reductionModel }
