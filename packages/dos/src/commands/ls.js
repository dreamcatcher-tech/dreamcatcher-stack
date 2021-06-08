const assert = require('assert')
const debug = require('debug')('dos:commands:ls')
const posix = require('path')
const cliui = require('cliui')
const chalk = require('ansi-colors')
const pad = require('pad-left')
module.exports = async function ls({ spinner, blockchain }, path = '.') {
  spinner.text = `Resolving ${path}`

  debug(`ls`, path)
  const { children } = await blockchain.ls(path)
  const ui = cliui()
  const aliases = Object.keys(children)
    .sort((a, b) => {
      if (a === '..') {
        return -1
      }
      if (b === '..') {
        return 1
      }
      if (a === '.') {
        return -1
      }
      if (b === '.') {
        return 1
      }
      if (a === '.@@io') {
        return -1
      }
      if (b === '.@@io') {
        return 1
      }

      const nameA = a.toUpperCase()
      const nameB = b.toUpperCase()
      if (nameA < nameB) {
        return -1
      }
      if (nameA > nameB) {
        return 1
      }
      return 0
    })
    .filter((alias) => !alias.includes('/'))
  debug(`aliases: `, aliases)
  aliases.forEach((alias) => {
    debug(`child: ${alias}`)
    let { systemRole, chainId, lineageHeight, heavyHeight, hash } =
      children[alias]
    chainId = chainId.length === 64 ? chainId.substring(0, 8) : chainId
    lineageHeight === -1 && (lineageHeight = '-')
    heavyHeight === -1 && (heavyHeight = '-')
    const height = heavyHeight + '.' + lineageHeight
    let filename
    if (systemRole !== 'UP_LINK') {
      filename = chalk.red(alias)
    } else {
      filename = chalk.green(alias)
    }
    // TODO use the same tools as networkPrint
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
