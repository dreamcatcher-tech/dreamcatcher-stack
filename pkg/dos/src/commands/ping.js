import posix from 'path-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:ping')

export const ping = async ({ spinner, blockchain }, path = '.', options) => {
  // TODO handle nested and remote paths
  // TODO make shell do wd resolution internally
  const { wd } = blockchain
  const absPath = posix.resolve(wd, path)
  debug(`ping path: %O options: %O`, absPath, options)
  await blockchain.ping(absPath)
}

const help = `
Send a ping to a chain, receive a response.

TODO: 
1. send data with the ping
2. ping indefinitely
3. do 4 pings and report average times
4. allow path pings
`
