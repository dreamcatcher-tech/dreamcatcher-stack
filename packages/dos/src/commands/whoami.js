const debug = require('debug')('dos:commands:whoami')
const chalk = require('ansi-colors')
const cliui = require('cliui')

module.exports = async ({ blockchain }) => {
  const chainId = blockchain.getState().getChainId()
  const ui = cliui()
  ui.div({ text: `User:`, width: 15 }, `root`)
  ui.div({ text: `Machine:`, width: 15 }, chalk.green(chainId))
  ui.div({ text: `Hypercomputer:`, width: 15 }, chalk.red(`NOT CONNECTED`))

  return { out: ui.toString() }
}

module.exports.help = `
Lists info about the current machine, current user, and connected hypercomputer
`
