import assert from 'assert-fast'
import { RxRequest } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:dmz:ping')

const ping = (payload = {}) => {
  if (typeof payload === 'string') {
    payload = { string: payload }
  }
  return { type: '@@PING', payload }
}
const pingReducer = (request) => {
  assert(request instanceof RxRequest)
  assert.strictEqual(request.type, '@@PING')
  const { payload } = request
  debug(`ping: %O`, payload)
  replyResolve(payload)
}

export { ping, pingReducer }
