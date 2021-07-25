const debug = require('debug')('dos:commands:ping')
const posix = require('path-browserify')
module.exports = async ({ spinner, blockchain }, path = '.', options) => {
  // TODO handle nested and remote paths
  // TODO make shell do wd resolution internally
  const { wd } = await blockchain.context()
  const absPath = posix.resolve(wd, path)
  debug(`ping path: %O options: %O`, absPath, options)
  await blockchain.ping(absPath)
}

module.exports.help = `
Send a ping to a chain, receive a response.

TODO: 
1. send data with the ping
2. ping indefinitely
3. do 4 pings and report average times
4. allow path pings
`
