const debug = require('debug')('dos-shell:commands:blocks')
const { blockPrint } = require('../../../w017-standard-engine')

module.exports = async ({ blockchain }) => {
  debug(`blocks`)
  // try open up the path if we do not have open already

  // set payload layer tasks in parallel to fetch all required
  let block
  let nextHeight = blockchain.getState().provenance.height
  let out = ''
  while (nextHeight >= 0) {
    const path = '.'
    block = blockchain.getState(path, nextHeight)
    out += blockPrint(block, '/test/') + `\n`
    nextHeight = block.provenance.height - 1
    debug(`next height: `, nextHeight)
  }
  return { out }
}

module.exports.help = `
Show the blocks of any given blockchain.
If no chain ID or alias given, print the blocks of the 
blockchain at the cwd
`
