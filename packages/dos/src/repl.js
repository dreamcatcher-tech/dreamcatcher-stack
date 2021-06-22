const debug = require('debug')('dos:repl')
const ora = require('ora')
const {
  effectorFactory,
  apps,
  checkModules,
  version,
} = require('@dreamcatcher-tech/interblock')
const { read } = require('./read')
const { evaluate } = require('./eval')
const { withAutoComplete } = require('./auto-complete')
const { withSpin } = require('./spinner')
const print = require('./print')
const loop = require('./loop')
const { version: dosVersion } = require('../package.json')

module.exports = async function repl(opts) {
  // require('debug').enable('*:repl *commands* *:eval')
  debug(`repl`)
  opts = opts || {}
  opts.read = opts.read || withAutoComplete(read)
  opts.evaluate = opts.evaluate || withSpin(evaluate)

  debug(`opts: `, Object.keys(opts))

  const ctx = await getInitialCtx(opts)

  const exec = async (input) => {
    let [cmd, ...cmdArgs] = input.split(' ').filter(Boolean)
    debug(`command: `, cmd, cmdArgs)

    await print(async () => {
      if (!noTiming.includes(cmd)) {
        cmdArgs = [cmd, ...cmdArgs]
        cmd = 'time'
      }
      const result = await opts.evaluate(ctx, cmd, cmdArgs)
      if (result && result.ctx) {
        Object.assign(ctx, result.ctx)
      }
      return result
    })
  }
  // await exec('cd /') // must make at least one block to have context
  // debug(`changing to home directory`)
  // await exec('cd /crm/customers')
  // await exec('./add --isTestData')
  // const children = ctx.blockchain.crm.customers.getChildren()
  // const child = Object.keys(children)[0]
  // await exec('cd ' + child)

  return loop(async function rep() {
    let input = 'exit'
    try {
      input = await opts.read(ctx)
    } catch (e) {
      if (e.message) {
        throw e
      }
      debug(`treating error as request to exit: `, e)
    }
    await exec(input)
  })
}

async function getInitialCtx({ blockchain, evaluate }) {
  // TODO move this to the reboot command
  // TODO get environment printout
  const spinner = ora({ spinner: 'aesthetic' }).start()
  spinner.info(`System font check: 🚦🚦🚦🌈🌈🌈❌️❌️❌️`)
  spinner.info(
    `begining boot sequence Ctrl+C to cancel and drop to local shell`
  )
  spinner.text = `checking for new app version on server "this webpage"`
  spinner.info(`current server build version: (unknown)`).start()
  spinner.text = `looking for previous chains under the domain "this webpage"`
  // TODO check if wasm support is available - TOR blocks this in strict mode
  spinner.info(`no previous chains found`).start()
  if (!blockchain) {
    spinner.text = `Initializing blockchain...`
    blockchain = await effectorFactory('console')
  }
  const chainId = blockchain.getState().getChainId()
  spinner.info(`Blockchain initialized with chainId: ${chainId}`).start()
  spinner.text = `connecting to mainnet...`
  spinner.info(`connection to mainnet established`).start()
  spinner.info(`mainnet latency: 543 ms`)
  spinner.info(`peer connection count: 1`).start()
  spinner.text = `benchmarking local system` // TODO move to dedicated command with params
  spinner.info(`local blockrate 23 blocks per second / 53 ms per block`)

  // spinner.text = `Provisioning app store`
  // spinner.start()
  // const publishStart = Date.now()
  // const { dpkgPath } = await blockchain.publish('crmApp', apps.crm.install)
  // const installStart = Date.now()
  // const publishMs = installStart - publishStart
  // spinner.info(`app store set up at: /${dpkgPath} in ${publishMs}ms`)
  // spinner.text = `installing crm app at /crm`
  // spinner.start()
  // await blockchain.install(dpkgPath, 'crm')
  // const installMs = Date.now() - installStart
  // const totalMs = Date.now() - publishStart
  // spinner.info(`crm app installed at /crm in ${installMs}ms`)
  // spinner.info(`total deployment time: ${totalMs}ms`)
  // spinner.stop()
  await awaitBlockchain(blockchain)

  await print(`Welcome to the HyperNet
  Blockchain core: v${version}
  DOS:             v${dosVersion}
  type "help" to get started`)
  const user = 'root'
  const machineId = 'local'
  spinner.stop()

  return { user, machineId, blockchain }
}

const noTiming = ['time', 'clear', 'help']

const awaitBlockchain = async (blockchain) => {
  const { state } = blockchain.getState()
  if (!state.context) {
    debug(`creating one block as workaround for no @@INIT action`)
    await blockchain.cd()
  }
}
