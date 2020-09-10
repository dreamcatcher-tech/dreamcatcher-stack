const Path = require('path').posix || require('path')
const debug = require('debug')('dos:commands:ls')
const cliui = require('cliui')
const chalk = require('ansi-colors')
const pad = require('pad/dist/pad.umd')
module.exports = async function ls({ spinner, blockchain }, path) {
  const { network } = blockchain.getState()
  spinner.text = `Resolving ${path}`

  // TODO allow any path by calling into shell directly ?
  const ui = cliui()
  Object.keys(network).forEach((key) => {
    debug(`child: ${key}`)
    const channel = network[key]
    let chainId = channel.address.getChainId().substring(0, 8)
    debug(`chainId: ${chainId}`)
    let filename
    let { lineageHeight, heavyHeight } = channel
    lineageHeight === -1 && (lineageHeight = '-')
    heavyHeight === -1 && (heavyHeight = '-')
    if (key === '.') {
      const selfHeight = blockchain.getState().provenance.height
      lineageHeight = heavyHeight = selfHeight
      chainId = blockchain.getState().getChainId().substring(0, 8)
    }

    const height = heavyHeight + '.' + lineageHeight
    if (channel.systemRole !== 'SYMLINK') {
      filename = chalk.red(key)
    } else {
      filename = chalk.magenta(key)
    }
    ui.div(
      { text: filename, width: 20 },
      { text: height, width: 10 },
      { text: chainId, width: 55 }
    )
  })
  return { out: ui.toString() }
}

module.exports.help = `
list the objects at the cwd.  lists alias, heavy height.lineage height, and chainId
`
