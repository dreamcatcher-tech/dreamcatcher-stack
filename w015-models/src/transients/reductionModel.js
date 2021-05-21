const assert = require('assert')
const { standardize } = require('../modelUtils')
const { txRequestModel } = require('./txRequestModel')
const { txReplyModel } = require('./txReplyModel')
const { rxReplyModel } = require('./rxReplyModel')
const { rxRequestModel } = require('./rxRequestModel')
const { registry } = require('../registry')

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
  create(reduceResolve, origin, dmz) {
    // TODO resolve circular reference problem
    let { reduction, isPending, requests, replies, ...rest } = reduceResolve
    assert.deepStrictEqual(rest, {})
    assert(Array.isArray(requests))
    assert(Array.isArray(replies))
    assert(rxRequestModel.isModel(origin) || rxReplyModel.isModel(origin))
    assert(registry.get('Dmz').isModel(dmz))
    requests = requests.map((request) => _inflate(request, origin))
    replies = replies.map((reply) => _inflate(reply, origin))
    requests.forEach((txRequest) => {
      if (txRequest.to === '.@@io') {
        assert(dmz.config.isPierced)
      }
    })
    // TODO check replies are to real actions
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
    assert(requests.every(txRequestModel.isModel))
    assert(replies.every(txReplyModel.isModel))
    let promiseCount = 0
    const sequenceSet = new Set()
    replies.forEach((txReply) => {
      // check the logic of the group of actions together
      if (txReply.getReply().isPromise()) {
        promiseCount++
      }
      sequenceSet.add(txReply.request.sequence)
    })

    assert(sequenceSet.size === replies.length, `Duplicate sequence detected`)
    if (isPending) {
      assert.strictEqual(promiseCount, 0, `No promises allowed if pending`)
    } else {
      assert(promiseCount <= 1, `Max one promise allowed: ${promiseCount}`)
    }
    const getIsPending = () => isPending
    return { getIsPending }
  },
})

module.exports = { reductionModel }
