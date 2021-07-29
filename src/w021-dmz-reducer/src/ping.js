import assert from 'assert'
const { replyResolve } = require('../../w002-api')
import Debug from 'debug'
const debug = Debug('interblock:dmz:ping')
const { rxRequestModel } = require('../../w015-models')

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

module.exports = { ping, pingReducer }
