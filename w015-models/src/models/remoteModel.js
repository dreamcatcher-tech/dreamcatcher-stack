const assert = require('assert')
const _ = require('lodash')
const { standardize } = require('../utils')
const { remoteSchema } = require('../schemas/modelSchemas')
const { addressModel } = require('./addressModel')
const remoteModel = standardize({
  schema: remoteSchema,
  create(remote = {}) {
    assert(typeof remote === 'object')
    const supplied = _.pick(remote, [
      'address',
      'requests',
      'replies',
      'heavyHeight',
      'lineageHeight',
    ])
    const defaultInstance = {
      address: addressModel.create(),
      requests: {},
      replies: {},
      heavyHeight: -1,
      lineageHeight: -1,
    }
    const instance = { ...defaultInstance, ...supplied }
    return remoteModel.clone(instance)
  },
  logicize(instance) {
    return {}
  },
})

module.exports = { remoteModel }
