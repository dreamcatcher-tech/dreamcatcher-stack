const util = require('util')
const debug = require('debug')('dos:commands:cat')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer')

module.exports = async ({ spinner, blockchain }, ...[path, ...args]) => {
  // TODO specify slices into state
  // TODO watch for state changes
  debug(`cat path: %O args: %O`, path, args)
  const { state } = await blockchain.cat(path)
  const out = util.inspect(state, { colors: true, depth: null })
  return { out }
}

module.exports.help = `
Show the internal state of a chain.

TODO
Args for full state, or partial state, or a particular path in the state.
`
