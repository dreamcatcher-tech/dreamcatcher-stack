const debug = require('debug')('dos:commands:blocks')
const { engine } = require('@dreamcatcher-tech/interblock')
const { blockPrint } = engine

module.exports = async ({ blockchain }, ...args) => {
  debug(`blocks %O`, args)
  // try open up the path if we do not have open already
  const { wd } = blockchain.getContext()
  const path = args[0] || wd
  debug(`using path: %o`, path)

  // TODO set payload layer tasks in parallel to fetch all required
  const segments = path.split('/')
  debug(`path segment count: `, segments.length)
  while (segments.length) {
    // pop, shift, check if root
    const segment = segments.shift()
    if (!segment) {
      continue
    }
    if (!blockchain[segment]) {
      throw new Error(`invalid path: ${path} stopped on: ${segment}`)
    }
    debug('segment: ', segment)
    blockchain = blockchain[segment]
  }
  let block
  const topHeight = blockchain.getState().provenance.height
  let nextHeight = 0
  let out = ''
  while (nextHeight <= topHeight) {
    block = blockchain.getState(nextHeight)
    out += blockPrint(block, path) + `\n`
    nextHeight++
    debug(`next height: `, nextHeight)
  }
  return { out }
}

module.exports.help = `
Show the blocks of any given blockchain.
If no chain ID or alias given, print the blocks of the 
blockchain at the cwd
`
