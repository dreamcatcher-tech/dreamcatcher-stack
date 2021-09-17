import Debug from 'debug'
const debug = Debug('dos:commands:dns')

export const dns = async ({ spinner, blockchain }, args) => {
  // TODO handle nested and remote paths
  debug(`dns %O`, args)
  return { out: module.exports.help }
}

const help = `
Service to map strings to chainIds.
Multiple services and manual overrides can be provided.
`
