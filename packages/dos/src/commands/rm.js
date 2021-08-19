import chalk from 'ansi-colors'
import Debug from 'debug'
const debug = Debug('dos:commands:rm')

export const rm = async ({ spinner, blockchain }, path) => {
  debug(`rm: %O`, path)
  const result = await blockchain.rm(path)
  debug(`result: %O`, result)
}

export const help = `
Remove blockchains.  If they are symlinks, will remove
the link only.  If children, will be permanently deleted.
`
