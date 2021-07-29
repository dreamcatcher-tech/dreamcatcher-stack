import assert from 'assert'
import Debug from 'debug'
const debug = Debug('interblock:dmz:getChannel')
const posix = require('path-browserify')
const { replyResolve } = require('../../w002-api')
const { getChannelParams } = require('./utils')

const getChannel = (alias = '.') => ({
  type: '@@GET_CHAN',
  payload: { alias },
})
const getChannelReducer = (network, action) => {
  let { alias } = action.payload
  assert.strictEqual(typeof alias, 'string')
  alias = posix.normalize(alias)
  debug(`getChannelReducer`, alias)
  if (network['..'].address.isRoot() && alias.startsWith('/')) {
    alias = alias.substring(1)
    alias = alias || '.'
  }
  if (!network[alias]) {
    throw new Error(`Unknown channel: ${alias}`)
  }
  replyResolve(getChannelParams(network, alias))
}
module.exports = { getChannel, getChannelReducer }
