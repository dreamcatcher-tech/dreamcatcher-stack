const debug = require('debug')('dos-shell')
const repl = require('./repl')
const { evaluate } = require('./eval')
const { withSpin } = require('./spinner')
const print = require('./print')
const fs = require('./filesystem')

module.exports = async function (argv, opts) {
  debug(`argv`, argv)
  argv = (argv || process.argv).slice(2)
  opts = opts || {}
  const ctx = await getInitialCtx(opts)
  debug(`argv`, argv)

  return argv.length
    ? evalPrint(ctx, argv[0], argv.slice(1), opts)
    : repl(ctx, opts)
}

async function getInitialCtx({ blockchain }) {
  if (!blockchain) {
    throw new Error(`No blockchain present`)
  }
  const user = 'guest'
  const machineId = 'dreamcatcher'
  return { user, machineId, blockchain }
}

function evalPrint(ctx, cmd, cmdArgs, opts) {
  debug(`evalPrint`)
  opts.evaluate = opts.evaluate || withSpin(evaluate)
  return print(() => opts.evaluate(ctx, cmd, cmdArgs))
}
