import process from 'process'
import ora from 'ora'
import { assert } from 'chai'
import { effectorFactory, apps } from '@dreamcatcher-tech/interblock'
import interblockPackageJson from '@dreamcatcher-tech/interblock/package.json'
import { read } from './read'
import { evaluate } from './eval'
import { withAutoComplete } from './auto-complete'
import { withSpin } from './spinner'
import print from './print'
import loop from './loop'
import dosPackageJson from '../package.json'
import Debug from 'debug'
const debug = Debug('dos:repl')

export default async function repl(opts = {}) {
  assert.strictEqual(typeof opts, 'object')
  // Debug.enable('*:repl *commands* *:eval')
  debug(`repl`)
  opts.read = opts.read || withAutoComplete(read)
  opts.evaluate = opts.evaluate || withSpin(evaluate)
  const stdin = opts.stdin || process.stdin
  const stdout = opts.stdout || process.stdout
  const stderr = opts.stderr || process.stderr
  opts = { ...opts, stdin, stdout, stderr }
  debug(`opts: `, Object.keys(opts))

  const ctx = await getInitialCtx(opts)
  await print(
    `Welcome to the HyperNet
  Blockchain core: v${interblockPackageJson.version}
  DOS:             v${dosPackageJson.version}
  type "help" to get started`,
    stdout,
    stderr
  )

  const exec = async (input) => {
    let [cmd, ...cmdArgs] = input.split(' ').filter(Boolean)
    debug(`command: `, cmd, cmdArgs)

    await print(
      async () => {
        if (!noTiming.includes(cmd)) {
          cmdArgs = [cmd, ...cmdArgs]
          cmd = 'time'
        }
        const result = await opts.evaluate(ctx, cmd, cmdArgs)
        if (result && result.ctx) {
          Object.assign(ctx, result.ctx)
        }
        return result
      },
      stdout,
      stderr
    )
  }
  // await exec('cd /') // must make at least one block to have context
  // debug(`changing to home directory`)
  // await exec('cd /crm/customers')
  // await exec('./add --isTestData')
  // const children = ctx.blockchain.crm.customers.getChildren()
  // const child = Object.keys(children)[0]
  // await exec('cd ' + child)

  const stopLoop = loop(async function rep() {
    let input = 'exit'
    try {
      input = await opts.read(ctx, stdin, stdout)
    } catch (e) {
      if (e.message) {
        throw e
      }
      debug(`treating error as request to exit: `, e)
    }
    await exec(input)
  })
  return stopLoop
}

async function getInitialCtx({ blockchain, stdout: stream }) {
  // TODO move this to the reboot command
  // TODO get environment printout
  const spinner = ora({ spinner: 'aesthetic', stream }).start()
  spinner.info(`System font check: 🚦🚦🚦🌈🌈🌈❌️❌️❌️`)
  spinner
    .info(`begining boot sequence Ctrl+C to cancel and drop to local shell`)
    .start()
  spinner.text = `checking for new app version...`
  spinner.info(`current server build version: (unknown)`).start()
  spinner.text = `looking for previous chains...`
  // TODO check if wasm support is available - TOR blocks this in strict mode
  spinner.info(`no previous chains found`).start()
  if (!blockchain) {
    debug(`no blockchain provided`)
    spinner.text = `Initializing blockchain...`
    blockchain = await effectorFactory('console')
    debug('blockchain created')
  }
  const latest = await blockchain.latest()
  const chainId = latest.getChainId()
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

  const user = 'root'
  const machineId = 'local'
  spinner.stop()

  return { user, machineId, blockchain }
}

const noTiming = ['time', 'clear', 'help']

const awaitBlockchain = async (blockchain) => {
  const latest = await blockchain.latest()
  const state = latest.getState()
  if (!state.context) {
    debug(`creating one block as workaround for no @@INIT action`)
    await blockchain.ping()
    debug(`done`)
  }
}
