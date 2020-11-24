const assert = require('assert')
const debug = require('debug')('interblock:models:lock')
const { v4: uuidCreator } = require('uuid')
const { standardize } = require('../utils')
const { timestampModel } = require('./timestampModel')
const { blockModel } = require('./blockModel')
const { interblockModel } = require('./interblockModel')
const { txReplyModel } = require('../transients/txReplyModel')
const { txRequestModel } = require('../transients/txRequestModel')

const schema = {
  title: 'Lock',
  description: 'Locking of the persistence layer for execution to take place.',
  type: 'object',
  required: ['uuid', 'timestamp', 'expires', 'interblocks', 'piercings'],
  additionalProperties: false,
  properties: {
    uuid: {
      type: 'string',
      description: 'uuidv4 identifying a lock on a chainId',
    },
    timestamp: timestampModel.schema,
    expires: {
      type: 'integer',
      description: 'ms until the lock expires',
      min: 0,
    },
    block: blockModel.schema,
    interblocks: {
      type: 'array',
      description:
        'Punched out blocks from other chains that have accumulated for this chain',
      uniqueItems: true,
      items: interblockModel.schema,
    },
    piercings: {
      type: 'object',
      description: 'Side effects',
      required: ['requests', 'replies'],
      properties: {
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
  },
}

// TODO let lock have two blocks, for when child immediately has its parent address burned in
// might use a flag to ask to refresh the lock
// or have a separate function on storage, to refresh the lock
const _defaultPiercings = { requests: [], replies: [] }
const lockModel = standardize({
  schema,
  create: (
    block,
    interblocks = [],
    uuid = uuidCreator(),
    piercings = _defaultPiercings
  ) => {
    assert(!block || blockModel.isModel(block))
    interblocks = interblocks.map(interblockModel.clone)
    piercings = refinePiercings(block, piercings)
    const timestamp = timestampModel.create()
    const expires = 2000
    const lock = { uuid, timestamp, expires, interblocks, piercings }
    if (block) {
      lock.block = block
    }
    return lockModel.clone(lock)
  },

  logicize: (instance) => {
    const { block, timestamp, expires, piercings } = instance
    const noDupes = refinePiercings(block, piercings)
    const { requests, replies } = piercings
    assert.strictEqual(noDupes.requests.length, requests.length)
    assert.strictEqual(noDupes.replies.length, replies.length)
    const isLocked = () => !timestamp.isExpired(expires)
    const isMatch = (lock) => lock.uuid === instance.uuid
    const isPiercingsPresent = () => requests.length || replies.length
    return {
      isLocked,
      isMatch,
      isPiercingsPresent,
    }
  },
})

const refinePiercings = (block, piercings) => {
  let { requests, replies } = piercings
  requests = requests.map((request) => {
    assert.strictEqual(typeof request, 'object')
    request = txRequestModel.clone(request)
    return request
  })
  requests = deduplicate(requests)
  replies = replies.map((reply) => {
    assert.strictEqual(typeof reply, 'object')
    reply = txReplyModel.clone(reply)
    return reply
  })
  replies = deduplicate(replies)
  return removeProcessedPiercings(block, { requests, replies })
}

const removeProcessedPiercings = (block, { requests, replies }) => {
  if (!block || !block.network['.@@io']) {
    return { requests, replies }
  }
  const ioChannel = block.network['.@@io']
  const {
    requests: remoteRequests,
    replies: remoteReplies,
  } = ioChannel.getRemote() // TODO handle replies

  const requestActions = Object.values(remoteRequests)
  const replyActions = Object.values(remoteReplies)

  requests = requests.filter(
    (request) => !requestActions.some((compare) => compare.equals(request))
  )
  replies = replies.filter(
    (reply) => !replyActions.some((compare) => compare.equals(reply))
  )
  return { requests, replies }
}

const deduplicate = (items) => {
  const dedupe = []
  items.forEach((item) => {
    if (dedupe.every((compare) => !item.equals(compare))) {
      dedupe.push(item)
    }
  })
  return dedupe
}

module.exports = {
  lockModel,
}
