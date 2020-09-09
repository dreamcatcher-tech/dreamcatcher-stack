const assert = require('assert')
const debug = require('debug')('interblock:models:lock')
const { v4: uuidCreator } = require('uuid')
const { standardize } = require('../utils')
const { timestampModel } = require('./timestampModel')
const { blockModel } = require('./blockModel')
const { interblockModel } = require('./interblockModel')

const schema = {
  title: 'Lock',
  description: 'Locking of the persistence layer for execution to take place.',
  type: 'object',
  required: ['uuid', 'timestamp', 'expires', 'interblocks'],
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
  },
}

// TODO let lock have two blocks, for when child immediately has its parent address burned in
// might use a flag to ask to refresh the lock
// or have a separate function on storage, to refresh the lock
const lockModel = standardize({
  schema,
  create: (block, interblocks = [], uuid = uuidCreator()) => {
    assert(!block || blockModel.isModel(block))
    interblocks = interblocks.map(interblockModel.clone)
    const timestamp = timestampModel.create()
    const expires = 2000
    const lock = { uuid, timestamp, expires, interblocks }
    if (block) {
      lock.block = block
    }
    const clone = lockModel.clone(lock)
    return clone
  },

  logicize: (instance) => {
    const { timestamp, expires } = instance
    const isLocked = () => !timestamp.isExpired(expires)
    const isMatch = (lock) => lock.uuid === instance.uuid
    return {
      isLocked,
      isMatch,
    }
  },
})

module.exports = {
  lockModel,
}
