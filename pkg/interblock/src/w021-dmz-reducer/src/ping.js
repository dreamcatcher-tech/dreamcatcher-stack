import assert from 'assert-fast'
import { replyResolve } from '../../w002-api'
import { rxRequestModel } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:dmz:ping')

const ping = (payload = {}) => {
  if (typeof payload === 'string') {
    payload = { string: payload }
  }
  return { type: '@@PING', payload }
}
const pingReducer = (request) => {
  assert(rxRequestModel.isModel(request))
  assert.strictEqual(request.type, '@@PING')
  const { payload } = request
  debug(`ping: %O`, payload)
  replyResolve(payload)
}

export { ping, pingReducer }
