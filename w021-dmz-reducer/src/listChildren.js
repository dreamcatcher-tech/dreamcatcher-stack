const debug = require('debug')('interblock:dmz:listChildren')
const { getChannelParams } = require('./utils')
const { replyResolve } = require('../../w002-api')

const listChildren = () => ({ type: '@@LS' })
const listChildrenReducer = (network) => {
  debug(`listChildrenReducer`)
  const children = {}
  const aliases = network.getAliases().filter((alias) => alias !== '.')
  aliases.forEach((alias) => {
    children[alias] = getChannelParams(network, alias)
  })
  replyResolve({ children })
}
module.exports = { listChildren, listChildrenReducer }
