import chalk from 'ansi-colors-browserify'
import cliui from 'cliui'
import Debug from 'debug'
const debug = Debug('dos:commands:whoami')

export const whoami = async ({ blockchain }) => {
  const latest = await blockchain.latest()
  const chainId = latest.getAddress().getChainId()
  const peerId = await blockchain.net.keypair.generatePeerId()
  const ui = cliui()
  ui.div({ text: `Root:`, width: 15 }, chainId)
  ui.div({ text: `Machine:`, width: 15 }, chalk.green(peerId))
  ui.div({ text: `Repo path:`, width: 15 }, blockchain.net.repo.path)
  ui.div({ text: `Hypercomputer:`, width: 15 }, chalk.red(`NOT CONNECTED`))

  const addrs = blockchain.net.getMultiaddrs()
  if (!addrs.length) {
    addrs.push(chalk.red(`NOT LISTENING`))
  }
  for (const addr of addrs) {
    ui.div({ text: `Address:`, width: 15 }, addr)
  }

  return { out: ui.toString() }
}

const help = `
Lists info about the current machine, current user, and connected hypercomputer
`
