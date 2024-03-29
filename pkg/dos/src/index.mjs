import process from 'process'
import repl from './repl'
import { evaluate } from './eval'
import { withSpin } from './spinner'
import print from './print'
import Debug from 'debug'
const debug = Debug('dos')

const evalPrint = (ctx, cmd, cmdArgs, opts) => {
  // TODO use this so can call commands from unit tests
  // can test the shell, but also test the infrastructure
  // can be used to store results in a long running graph
  debug(`evalPrint`)
  opts.evaluate = opts.evaluate || withSpin(evaluate)
  return print(() => opts.evaluate(ctx, cmd, cmdArgs))
}

export default async (argv, opts = {}) => {
  debug(`argv`, argv)
  argv = (argv || process.argv).slice(2)
  debug(`argv`, argv)
  if (typeof argv[0] === 'string') {
    opts.repo = argv[0]
  }
  if (typeof argv[1] === 'string') {
    opts.tcpPort = argv[1]
  }
  debug(opts)
  // return argv.length ? evalPrint(ctx, argv[0], argv.slice(1), opts) : repl(opts)
  return repl(opts)
}
