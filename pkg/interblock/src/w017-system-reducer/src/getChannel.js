import assert from 'assert-fast'
import posix from 'path-browserify'
import { getChannelParams } from './utils'
import Debug from 'debug'
const debug = Debug('interblock:dmz:getChannel')

const getChannel = (alias = '.') => ({
  type: '@@GET_CHAN',
  payload: { alias },
})
const getChannelReducer = (network, action) => {
  let { alias } = action.payload
  assert.strictEqual(typeof alias, 'string')
  alias = posix.normalize(alias)
  debug(`getChannelReducer`, alias)
  if (network.get('..').address.isRoot() && alias.startsWith('/')) {
    alias = alias.substring(1)
    alias = alias || '.'
  }
  if (!network.has(alias)) {
    throw new Error(`Unknown channel: ${alias}`)
  }
  replyResolve(getChannelParams(network, alias))
}
export { getChannel, getChannelReducer }
