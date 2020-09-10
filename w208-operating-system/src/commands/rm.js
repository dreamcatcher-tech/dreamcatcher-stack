const debug = require('debug')('dos:commands:rm')
const chalk = require('ansi-colors')
const { prompt } = require('enquirer')

module.exports = async ({ spinner, blockchain }, path) => {
  debug(`rm: %O`, path)
  const result = await blockchain.rm(path)
  debug(`result: %O`, result)
}

module.exports.help = `
Remove blockchains.  If they are symlinks, will remove
the link only.  If children, will be permanently deleted.
`
