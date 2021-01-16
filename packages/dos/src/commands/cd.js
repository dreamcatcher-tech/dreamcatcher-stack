const assert = require('assert')
const Path = require('path').posix || require('path')
const debug = require('debug')('dos:commands:cd')

const cd = async ({ spinner, blockchain }, path = '.') => {
  assert.strictEqual(typeof path, 'string')
  debug(`cd: ${path}`)
  spinner.text = `Resolving: ${path}`

  await blockchain.cd(path)
  const context = blockchain.getContext()
  debug(`context: %O`, context)
  const { wd } = context
  return { ctx: { wd } }
}

module.exports = cd

module.exports.help = `
Navigate through the filesystem graph using Posix compliant pathing.
Can jump straight to an object by specifying a chainId.
`
