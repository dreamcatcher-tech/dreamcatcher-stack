import posix from 'path-browserify'
import cliuiModule from 'cliui'
import chalk from 'ansi-colors-browserify'
import Debug from 'debug'
const debug = Debug('dos:commands:ls')
const cliui = cliuiModule.default || cliuiModule // issues loading in browser

export const ls = async ({ spinner, blockchain }, path = '.') => {
  spinner.text = `Resolving ${path}`

  debug(`ls`, path)
  let { children } = await blockchain.ls(path)
  children = { ...children }

  // TODO implement this in shell, not externally
  const { wd } = await blockchain.context()
  const absPath = posix.resolve(wd, path)
  const actions = await blockchain.actions(absPath)
  debug(`actions`, actions)
  const actionNames = Object.keys(actions).map((name) => {
    const localName = `./${name}()`
    children[localName] = { systemRole: 'function' }
    return localName
  })

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

  aliases.splice(0, 0, ...actionNames)
  debug(`aliases: `, aliases)
  aliases.forEach((alias) => {
    debug(`child: ${alias}`)
    let { systemRole, chainId, hash = '', height = '' } = children[alias]
    let filename = alias

    if (systemRole !== 'function') {
      chainId = chainId.length === 64 ? chainId.substring(0, 8) : chainId
      hash = hash.length === 64 ? hash.substring(0, 8) : hash
      if (systemRole !== 'UP_LINK') {
        filename = chalk.blueBright(alias)
      } else {
        filename = chalk.green(alias)
      }
    } else {
      filename = chalk.red(alias)
      height = ''
      chainId = '(function)'
    }

    // TODO use the same tools as networkPrint
    debug(filename, height, chainId, hash)

    ui.div(
      { text: filename, width: 35 },
      { text: height + '', width: 10 },
      { text: chainId, width: 13 },
      { text: hash, width: 55 }
    )
  })
  return { out: ui.toString() }
}

const help = `
list the objects at the cwd.  lists alias, heavy height.lineage height, and chainId
`
