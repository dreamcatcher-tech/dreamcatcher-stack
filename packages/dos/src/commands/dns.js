const debug = require('debug')('dos:commands:dns')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer')

module.exports = async ({ spinner, blockchain }, args) => {
  // TODO handle nested and remote paths
  debug(`dns %O`, args)
  return { out: module.exports.help }
}

module.exports.help = `
Service to map strings to chainIds.
Multiple services and manual overrides can be provided.
`
