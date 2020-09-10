const debug = require('debug')('dos:commands:ping')

module.exports = async ({ spinner, blockchain }, path, options) => {
  // TODO handle nested and remote paths
  debug(`ping path: %O options: %O`, path, options)
  await blockchain.ping(path)
}

module.exports.help = `
Send a ping to a chain, receive a response.

TODO: 
1. send data with the ping
2. ping indefinitely
3. do 4 pings and report average times
4. allow path pings
`
