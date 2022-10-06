import cliuiModule from 'cliui'
import chalk from 'ansi-colors-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:ls')
const cliui = cliuiModule.default || cliuiModule // issues loading in browser

export const ls = async ({ spinner, blockchain }, path = '.') => {
  spinner.text = `Resolving ${path}`

  debug(`ls`, path)
  let { children, api } = await blockchain.ls(path)
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
    let { chainId, tip, precedent, hash = '' } = children[alias]
    let filename = alias
    hash = hash.length >= 50 ? hash.substring(0, 14) : hash
    filename = chalk.green(alias)
    // TODO use the same tools as networkPrint

    ui.div(
      { text: filename, width: 35 },
      { text: chainId, width: 48 },
      { text: hash, width: 55 }
    )
  })
  Object.keys(api).forEach((functionName) => {
    const filename = chalk.red(functionName + '()')
    const chainId = '(function)'

    ui.div(
      { text: filename, width: 35 },
      { text: chainId, width: 48 },
      { text: '', width: 55 }
    )
  })
  return { out: ui.toString() }
}

const help = `
list the objects at the cwd.  lists alias, heavy height.lineage height, and chainId
`
