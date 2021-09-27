import { assert } from 'chai/index.mjs'
import { v4 as uuidCreator } from 'uuid'
import { standardize } from '../modelUtils'
import { timestampModel } from './timestampModel'
import { blockModel } from './blockModel'
import { interblockModel } from './interblockModel'
import { txReplyModel } from '../transients/txReplyModel'
import { txRequestModel } from '../transients/txRequestModel'
import Debug from 'debug'
const debug = Debug('interblock:models:lock')

const schema = {
  title: 'Lock',
  // description: 'Locking of the persistence layer for execution to take place.',
  type: 'object',
  required: ['uuid', 'timestamp', 'expires', 'interblocks', 'piercings'],
  additionalProperties: false,
  properties: {
    uuid: {
      type: 'string',
      // description: 'uuidv4 identifying a lock on a chainId',
    },
    timestamp: timestampModel.schema,
    expires: {
      type: 'integer',
      // description: 'ms until the lock expires',
      minimum: 0,
    },
    block: blockModel.schema,
    interblocks: {
      type: 'array',
      // description:
      //   'Punched out blocks from other chains that have accumulated for this chain',
      uniqueItems: true,
      items: interblockModel.schema,
    },
    piercings: {
      type: 'object',
      // description: 'Side effects',
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
    const { block, timestamp, expires, piercings, interblocks } = instance
    const noDupes = refinePiercings(block, piercings)
    const { requests, replies } = piercings
    assert.strictEqual(noDupes.requests.length, requests.length)
    assert.strictEqual(noDupes.replies.length, replies.length)
    // TODO remove light blocks from lock - will be superseded when modelchains is implemented
    // assertUniqueHeights(interblocks)
    // TODO check piercings are sorted correctly
    // TODO assert that if no block, cannot be any interblocks
    // TODO check all interblocks are valid in this block
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
const assertUniqueHeights = (interblocks) => {
  const identifiers = new Set()
  for (const interblock of interblocks) {
    const height = interblock.provenance.height
    const chainId = interblock.getChainId()
    const id = `${height}_${chainId}`
    assert(!identifiers.has(id), `Duplicate block: ${id}`)
    identifiers.add(id)
  }
}
const refinePiercings = (block, piercings) => {
  let { requests, replies } = piercings
  requests = requests.map((request) => {
    assert.strictEqual(typeof request, 'object')
    request = txRequestModel.clone(request)
    return request
  })
  requests = sort(deduplicatePiercings(requests))
  replies = replies.map((reply) => {
    assert.strictEqual(typeof reply, 'object')
    reply = txReplyModel.clone(reply)
    return reply
  })
  replies = sort(deduplicatePiercings(replies))
  return removeProcessedPiercings(block, { requests, replies })
}

const removeProcessedPiercings = (block, { requests, replies }) => {
  if (!block || !block.network['.@@io']) {
    return { requests, replies }
  }
  const ioChannel = block.network['.@@io']
  const { requests: remoteRequests, replies: remoteReplies } =
    ioChannel.getRemote() // TODO handle replies

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

const deduplicatePiercings = (items) => {
  const dedupe = []
  items.forEach((item) => {
    if (dedupe.every((compare) => !item.equals(compare))) {
      dedupe.push(item)
    }
  })
  const isRequestsSequenced = dedupe.every((action) => {
    if (txRequestModel.isModel(action)) {
      return typeof action.payload['__@@ioSequence'] === 'string'
    } else {
      // TODO require some sequencing on piercing replies too
      return txReplyModel.isModel(action)
    }
  })
  assert(isRequestsSequenced)
  return dedupe
}
const sort = (items) => {
  return items.sort((a, b) => {
    const aSeq = a.payload['__@@ioSequence']
    const bSeq = b.payload['__@@ioSequence']
    return aSeq.localeCompare(bSeq)
  })
}

export { lockModel }
