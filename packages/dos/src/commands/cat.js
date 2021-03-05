const util = require('util')
const debug = require('debug')('dos:commands:cat')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer')
const posix = require('path')

module.exports = async ({ spinner, blockchain }, ...[path = '.', ...args]) => {
  // TODO specify slices into state
  // TODO watch for state changes
  // TODO move to be a shell command that returns a binary payload
  debug(`cat path: %O args: %O`, path, args)
  const { wd } = blockchain.getContext()
  const absolutePath = posix.resolve(wd, path)
  debug(`absolutePath`, absolutePath)
  const latest = await blockchain.getLatestFromPath(absolutePath)
  const { state } = latest
  const out = util.inspect(state, { colors: true, depth: null })
  return { out }
}

module.exports.help = `
Show the internal state of a chain.

TODO
Args for full state, or partial state, or a particular path in the state.
`
