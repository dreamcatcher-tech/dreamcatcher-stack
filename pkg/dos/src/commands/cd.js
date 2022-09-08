import { assert } from 'chai/index.mjs'
import Debug from 'debug'
const debug = Debug('dos:commands:cd')

export const cd = async ({ spinner, blockchain }, path = '.') => {
  assert.strictEqual(typeof path, 'string')
  debug(`cd: ${path}`)
  spinner.text = `Resolving: ${path}`
  await blockchain.cd(path)
  const { wd } = blockchain
  return { ctx: { wd } }
}

const help = `
Navigate through the filesystem graph using Posix compliant pathing.
Can jump straight to an object by specifying a chainId.
`
