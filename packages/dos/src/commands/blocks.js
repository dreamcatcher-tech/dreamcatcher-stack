const debug = require('debug')('dos:commands:blocks')
const { engine } = require('@dreamcatcher-tech/interblock')
const { blockPrint } = engine

module.exports = async ({ blockchain }, ...args) => {
  debug(`blocks %O`, args)
  // try open up the path if we do not have open already
  const { wd } = blockchain.getContext()
  const path = args[0] || wd
  debug(`using path: %o`, path)

  // set payload layer tasks in parallel to fetch all required
  let block
  let chain = path === wd ? blockchain : blockchain[path]
  const topHeight = chain.getState().provenance.height
  let nextHeight = 0
  let out = ''
  while (nextHeight <= topHeight) {
    const statePath = []
    block = chain.getState(statePath, nextHeight)
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
