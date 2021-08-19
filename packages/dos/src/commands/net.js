import chalk from 'ansi-colors'
import Debug from 'debug'
const debug = Debug('dos:commands:tx')

export const net = async ({ spinner, blockchain }) => {
  // TODO handle nested and remote paths
  debug(`TODO tx: %O`)
}

export const help = `
List and modify the transports used.  These are typically URLs
which point to various block producing peers
`
