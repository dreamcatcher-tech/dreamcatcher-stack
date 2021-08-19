import chalk from 'ansi-colors'
import cliui from 'cliui'
import Debug from 'debug'
const debug = Debug('dos:commands:whoami')

export const whoami = async ({ blockchain }) => {
  const chainId = blockchain.getState().getChainId()
  const ui = cliui()
  ui.div({ text: `User:`, width: 15 }, `root`)
  ui.div({ text: `Machine:`, width: 15 }, chalk.green(chainId))
  ui.div({ text: `Hypercomputer:`, width: 15 }, chalk.red(`NOT CONNECTED`))

  return { out: ui.toString() }
}

export const help = `
Lists info about the current machine, current user, and connected hypercomputer
`
