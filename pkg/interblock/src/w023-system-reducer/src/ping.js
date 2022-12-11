import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:dmz:ping')

const pingReducer = (request) => {
  assert.strictEqual(request.type, '@@PING')
  const { payload } = request
  assert.strictEqual(typeof payload, 'object')
  debug(`ping: %O`, payload)
  return payload
}

export { pingReducer }
