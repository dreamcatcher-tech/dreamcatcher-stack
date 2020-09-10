const debug = require('debug')('dos:commands:tx')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer')

module.exports = async ({ spinner, blockchain }) => {
  // TODO handle nested and remote paths
  debug(`TODO tx: %O`)
}

module.exports.help = `
List and modify the transports used.  These are typically URLs
which point to various block producing peers
`
