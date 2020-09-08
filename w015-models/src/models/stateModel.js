const assert = require('assert')
const isCircular = require('is-circular')
const { standardize } = require('../utils')
const { txRequestModel } = require('../transients/txRequestModel')
const { txReplyModel } = require('../transients/txReplyModel')
const { rxReplyModel } = require('../transients/rxReplyModel')
const { rxRequestModel } = require('../transients/rxRequestModel')
const { assertNoUndefined } = require('../assertNoUndefined')

const schema = {
  title: 'State',
  description: `The result of running a covenant is stored here.
It checks the state minus the actions is serializable
Includes the array of requests and replies returned from 
reducing the covenant.  These actions are intended to be transmitted
via the network.  This model enforces the format and logic of the
returns from the reducer

This is how covenant info is ingested back into the trusted system.
It is crucial that the format of this data is correct

Entry point from covenant to system.

Maximally inflates actions with defaults.  Logical checking is done inside
the networkProducer as needs context of the initiating action to fill in
remaining defaults

The actions in from the covenant are refined over three states:
1. create( state ) inflates actions to pass schema validation
2. logicize( state ) checks static logic
3. networkProducer.tx( state ) checks context logic

The returned model is forbidden to have an actions key on it.
The validation is run during clone, then logicize strips the actions out.

Create is only called immediately after a reducer call returns some state.
Therefore, we always know what the default action is, so we require it of create.
`,

  type: 'object',
  required: [],
  additionalProperties: true,
  properties: {
    actions: {
      type: 'array',
      uniqueItems: false,
      items: { oneOf: [txRequestModel.schema, txReplyModel.schema] },
    },
  },
}

const inflate = (action, defaultAction) => {
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

const stateModel = standardize({
  schema,
  create(state = {}, defaultAction) {
    assert.equal(typeof state, 'object')
    let { actions, ...rest } = state
    if (defaultAction) {
      assert(
        rxRequestModel.isModel(defaultAction) ||
          rxReplyModel.isModel(defaultAction),
        `defaultAction must be either rxRequest or rxReply: ${defaultAction}`
      )
    }
    if (actions) {
      if (!Array.isArray(actions) && actions) {
        actions = [actions]
      }
      const inflated = actions.map((action) => inflate(action, defaultAction))
      actions = inflated
      rest = { actions, ...rest }
    }
    // TODO reuse dmz models if this is for system state

    return stateModel.clone(rest)
  },
  logicize(instance) {
    // all logic checks go here, to cover cloning
    assertSerializable(instance)
    const { actions = [], ...state } = instance
    assert(Array.isArray(actions), `actions must be an array: ${actions}`)

    const requests = []
    const replies = []

    // check the logic of the group of actions together
    actions.forEach((action) => {
      if (_isReply(action.type)) {
        const nextReply = txReplyModel.clone(action)
        replies.forEach((reply) => {
          if (reply.isPromise()) {
            assert(!nextReply.isPromise(), `Duplicate promise: ${action}`)
          }
          const duplicateReplySequence =
            reply.request.sequence !== nextReply.request.sequence
          assert(duplicateReplySequence, `Duplicate reply: ${action}`)
        })
        replies.push(nextReply)
      } else {
        const nextRequest = txRequestModel.clone(action)
        requests.push(nextRequest)
      }
    })

    const getRequests = () => [...requests]
    const getReplies = () => [...replies]
    const getState = () => state
    return { getRequests, getReplies, getState }
  },
})
const assertSerializable = (object) => {
  assertNoUndefined(object)
  // TODO ensure this check is sufficient for stringify
  if (isCircular(object)) {
    // TODO move to traverse
    throw new Error(`state must be stringifiable`)
  }
}
module.exports = { stateModel }
