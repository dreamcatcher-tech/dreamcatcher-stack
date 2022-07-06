import assert from 'assert-fast'
import { Request } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:dmz:ping')

const ping = (payload = {}) => {
  if (typeof payload === 'string') {
    payload = { string: payload }
  }
  return { type: '@@PING', payload }
}
const pingReducer = (request) => {
  assert(request instanceof Request)
  assert.strictEqual(request.type, '@@PING')
  const { payload } = request
  debug(`ping: %O`, payload)
  return payload
}

export { ping, pingReducer }
