const assert = require('assert')
const debug = require('debug')('interblock:models:lock')
const { v4: uuidCreator } = require('uuid')
const { standardize } = require('../utils')
const { timestampModel } = require('./timestampModel')
const { blockModel } = require('./blockModel')
const { interblockModel } = require('./interblockModel')
const { actionModel } = require('./actionModel')

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
      type: 'array',
      description: 'Side effects',
      uniqueItems: true,
      items: actionModel.schema,
    },
  },
}

// TODO let lock have two blocks, for when child immediately has its parent address burned in
// might use a flag to ask to refresh the lock
// or have a separate function on storage, to refresh the lock
const lockModel = standardize({
  schema,
  create: (block, interblocks = [], uuid = uuidCreator(), piercings = []) => {
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
    const noDuplicates = refinePiercings(block, piercings)
    assert.strictEqual(noDuplicates.length, piercings.length)
    const isLocked = () => !timestamp.isExpired(expires)
    const isMatch = (lock) => lock.uuid === instance.uuid
    return {
      isLocked,
      isMatch,
    }
  },
})

const refinePiercings = (block, piercings) => {
  piercings = deduplicate(piercings)
  piercings = removeProcessedPiercings(block, piercings)
  return piercings
}

const removeProcessedPiercings = (block, piercings) => {
  if (!block || !block.network['@@io']) {
    return piercings
  }
  const ioChannel = block.network['@@io']
  const { requests } = ioChannel.getRemote() // TODO handle replies
  const requestActions = Object.values(requests)
  const unprocessed = piercings.filter(
    (action) => !requestActions.some((compare) => compare.equals(action))
  )
  return unprocessed
}

const deduplicate = (piercings) => {
  const dedupe = []
  piercings.forEach((action) => {
    if (dedupe.every((compare) => !compare.equals(action))) {
      dedupe.push(action)
    }
  })
  return dedupe
}

module.exports = {
  lockModel,
}
