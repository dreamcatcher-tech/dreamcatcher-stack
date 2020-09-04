const debug = require('debug')('dos-shell')
const repl = require('./repl')
const { evaluate } = require('./eval')
const { withSpin } = require('./spinner')
const print = require('./print')

module.exports = async function (argv, opts = {}) {
  debug(`argv`, argv)
  argv = (argv || process.argv).slice(2)
  debug(`argv`, argv)

  return argv.length ? evalPrint(ctx, argv[0], argv.slice(1), opts) : repl(opts)
}

function evalPrint(ctx, cmd, cmdArgs, opts) {
  // TODO use this so can call commands from unit tests
  // can test the shell, but also test the infrastructure
  // can be used to store results in a long running graph
  debug(`evalPrint`)
  opts.evaluate = opts.evaluate || withSpin(evaluate)
  return print(() => opts.evaluate(ctx, cmd, cmdArgs))
}
