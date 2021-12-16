import { Timestamp, Block, Interblock, TxRequest, TxReply } from '.'
import { v4 } from 'uuid'

import { mixin } from '../MapFactory'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:classes:Lock')

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
    timestamp: Timestamp.schema,
    expires: {
      type: 'integer',
      // description: 'ms until the lock expires',
      minimum: 0,
    },
    block: Block.schema,
    interblocks: {
      type: 'array',
      // description:
      //   'Punched out blocks from other chains that have accumulated for this chain',
      uniqueItems: true,
      items: Interblock.schema,
    },
    piercings: {
      type: 'object',
      // description: 'Side effects',
      required: ['requests', 'replies'],
      properties: {
        requests: {
          type: 'array',
          uniqueItems: true,
          items: TxRequest.schema,
        },
        replies: {
          type: 'array',
          uniqueItems: true,
          items: TxReply.schema,
        },
      },
    },
  },
}
// TODO let lock have two blocks, for when child immediately has its parent address burned in
// might use a flag to ask to refresh the lock
// or have a separate function on storage, to refresh the lock
const _piercings = { requests: [], replies: [] }
export class Lock extends mixin(schema) {
  static create(block, interblocks = [], uuid = v4(), piercings = _piercings) {
    assert(interblocks.every((i) => i instanceof Interblock))
    interblocks = sortInterblocks(interblocks)
    piercings = refinePiercings(block, piercings)
    const timestamp = Timestamp.create()
    const expires = 2000
    const lock = { uuid, timestamp, expires, interblocks, piercings }
    if (block) {
      lock.block = block
    }
    return super.create(lock)
  }
  assertLogic() {
    const { block, timestamp, expires, piercings, interblocks } = this
    const noDupes = refinePiercings(block, piercings)
    const { requests, replies } = piercings
    assert.strictEqual(noDupes.requests.length, requests.length)
    assert.strictEqual(noDupes.replies.length, replies.length)
    if (block) {
      assert(block instanceof Block)
    }
    // TODO assertPrecedentChain( block, interblocks )
    assertUniqueHeights(interblocks)
    // TODO assert interblocks are sorted in height
    // TODO check piercings are sorted correctly
    // TODO check all interblocks are valid in this block
  }
  isLocked() {
    return !this.timestamp.isExpired(this.expires)
  }
  isMatch(lock) {
    return lock.uuid === this.uuid
  }
  isPiercingsPresent() {
    const { replies, requests } = this.piercings
    return !!replies.length || !!requests.length
  }
}
const sortInterblocks = (interblocks) => {
  interblocks = [...interblocks]
  return interblocks.sort((a, b) => {
    const aSeq = a.provenance.height
    const bSeq = b.provenance.height
    return aSeq - bSeq
  })
}
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
    request = TxRequest.create(request)
    return request
  })
  requests = sort(deduplicatePiercings(requests))
  replies = replies.map((reply) => {
    assert.strictEqual(typeof reply, 'object')
    reply = TxReply.create(reply)
    return reply
  })
  replies = sort(deduplicatePiercings(replies))
  return removeProcessedPiercings(block, { requests, replies })
}

const removeProcessedPiercings = (block, { requests, replies }) => {
  debug(block)
  if (!block || !block.network.has('.@@io')) {
    return { requests, replies }
  }
  const ioChannel = block.network['.@@io']
  // TODO on a transmitting block, remove piercings that have been replied to
  // or those replies that have been ingested by rxRepliesTip
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
    if (action instanceof TxRequest) {
      return typeof action.payload['__@@ioSequence'] === 'string'
    } else {
      // TODO require some sequencing on piercing replies too
      return action instanceof TxReply
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
