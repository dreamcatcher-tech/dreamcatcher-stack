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
  if (isReplyType(type)) {
    throw new Error(`Reserved type used: ${type}`)
  }
  const request = {
    type,
    payload,
    to,
  }
  return request
}

const _txReply = (type = '@@RESOLVE', payload = {}, identifier) => {
  switch (type) {
    case '@@PROMISE':
      if (Object.keys(payload).length) {
        throw new Error(`Promise payload must be empty`)
      }
      if (identifier) {
        throw new Error(`can only promise to the current request - leave blank`)
      }
      break
    case '@@RESOLVE':
      break
    case '@@REJECT':
      payload = typeof payload === 'string' ? new Error(payload) : payload
      break
    default:
      throw new Error(`Disallowed type: ${type}`)
  }
  if (typeof payload !== 'object') {
    throw new Error(`payload must be object: ${typeof payload}`)
  }
  if (typeof identifier !== 'string' && typeof identifier !== 'undefined') {
    throw new Error(`identifier must be string: ${typeof identifier}`)
  }
  const reply = {
    type,
    payload,
    identifier,
  }
  // let thru empty request so can auto fill by system
  return reply
}

const promise = () => _txReply('@@PROMISE')
const resolve = (payload, identifier) =>
  _txReply('@@RESOLVE', payload, identifier)
const reject = (error, identifier) => _txReply('@@REJECT', error, identifier)
const isReplyType = (type) =>
  ['@@RESOLVE', '@@REJECT', '@@PROMISE'].includes(type)
export { request, resolve, reject, isReplyType }
