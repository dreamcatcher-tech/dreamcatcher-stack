const traverse = require('traverse')
const equal = require('fast-deep-equal')

/**
 * ACTION CREATORS FOR USE INSIDE COVENANTS
 *
 * These functions will produce actions that should be
 * put into the array named "actions" on the returned state.
 */

const request = (type, payload = {}, to = '.') => {
  if (!type) {
    throw new Error('Must supply at least one arg')
  }
  if (typeof type === 'object') {
    if (typeof payload === 'string') {
      to = payload
    } else {
      to = type.to || '.'
    }
    payload = type.payload || {}
    type = type.type
  }
  if (typeof type !== 'string') {
    throw new Error(`"type" must be a string: ${type}`)
  }
  if (typeof to !== 'string') {
    // TODO use path regex to ensure correct formating
    throw new Error(`"to" must be a string: ${to}`)
  }
  if (typeof payload !== 'object') {
    throw new Error(`"payload" must be an object: ${payload}`)
  }
  const request = {
    type,
    payload,
    to,
  }
  return request
}

const _txReply = (type = '@@RESOLVE', payload = {}, request) => {
  switch (type) {
    case '@@PROMISE':
      if (Object.keys(payload).length) {
        throw new Error(`Promise payload must be empty`)
      }
      if (request) {
        throw new Error(`can only promise to the current request - leave blank`)
      }
      break
    case '@@RESOLVE':
      break
    case '@@REJECT':
      break
    default:
      throw new Error(`Disallowed type: ${type}`)
  }
  if (typeof payload !== 'object') {
    throw new Error(`payload must be object: ${payload}`)
  }
  const reply = {
    type,
    payload,
    request,
  }
  // let thru empty request so can auto fill by system
  return reply
}

const promise = () => _txReply('@@PROMISE')
const resolve = (payload, request) => _txReply('@@RESOLVE', payload, request)
const reject = (error, request) => _txReply('@@RESOLVE', error, request)

const isReplyFor = (reply, request) => {
  if (request && typeof request !== 'object') {
    return false
  }
  if (_isNotReply(reply)) {
    return false
  }
  if (!request) {
    return true
  }
  const { type, payload } = request
  const repliedRequest = reply && reply.request
  return (
    repliedRequest &&
    repliedRequest.type === type &&
    equal(repliedRequest.payload, payload)
  )
}

const _replyTypes = ['@@PROMISE', '@@RESOLVE', '@@REJECT']
const _isNotReply = (reply) => {
  return !reply || !reply.type || !_replyTypes.includes(reply.type)
}

const _assertNoUndefined = (obj) => {
  traverse(obj).forEach(function (val) {
    if (typeof val === 'undefined') {
      throw new Error(`Values cannot be undefined: ${this.path}`)
    }
  })
}

module.exports = { request, promise, resolve, reject, isReplyFor }
