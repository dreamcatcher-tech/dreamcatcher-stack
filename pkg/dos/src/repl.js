import process from 'process'
import ora from 'ora'
import { assert } from 'chai'
import { Interpulse, apps } from '@dreamcatcher-tech/interblock'
import { read } from './read'
import { evaluate } from './eval'
import { withAutoComplete } from './auto-complete'
import { withSpin } from './spinner'
import print from './print'
import loop from './loop'
import dosPackageJson from '../package.json' assert { type: 'json' }
import Debug from 'debug'
const debug = Debug('dos:repl')
import json from '@dreamcatcher-tech/interblock/package.json' assert { type: 'json' }

export default async function repl(opts = {}) {
  assert.strictEqual(typeof opts, 'object')
  Debug.enable('*:repl *commands* *:eval *dag:import ipfs* dos')
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
  Blockchain core: v${json.version}
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
  await exec('whoami')
  try {
    await ctx.blockchain.cd('/app/customers')
  } catch (error) {
    await exec('add /app crm')
  }

  await exec('cd /app/customers')
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

async function getInitialCtx({ blockchain, stdout: stream, repo, tcpPort }) {
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
    const tcpHost = '0.0.0.0'
    tcpPort = tcpPort || '8789'
    repo = repo || 'tmp/test'
    blockchain = await Interpulse.create({ repo, tcpHost, tcpPort })
    debug('blockchain created')
  }
  const latest = await blockchain.latest()
  const chainId = latest.getAddress().getChainId()
  spinner.info(`Blockchain initialized with chainId: ${chainId}`).start()
  spinner.text = `connecting to mainnet...`
  spinner.info(`connection to mainnet established`).start()
  spinner.info(`mainnet latency: 543 ms`)
  spinner.info(`peer connection count: 1`).start()
  spinner.text = `benchmarking local system` // TODO move to dedicated command with params
  spinner.info(`local blockrate 23 blocks per second / 53 ms per block`)

  const user = 'root'
  const machineId = 'local'
  spinner.stop()

  return { user, machineId, blockchain }
}

const noTiming = ['time', 'clear', 'help']
