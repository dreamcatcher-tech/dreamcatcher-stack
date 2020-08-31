const debug = require('debug')('dos-shell:repl')
const { read } = require('./read')
const { evaluate } = require('./eval')
const { withAutoComplete } = require('./auto-complete')
const { withSpin } = require('./spinner')
const print = require('./print')
const loop = require('./loop')
const commands = require('./commands')
const wrap = require('wordwrap')(0, 80)

module.exports = async function repl(ctx, opts) {
  debug(`repl`)
  opts = opts || {}
  // debug(`ctx`, ctx)
  // debug(`opts`, opts)

  await print(`Welcome to the HyperNet
  Blockchain core: v0.0.5
  Terminal:        v0.0.12`)
  const { out } = await commands.help(ctx)

  opts.read = opts.read || withAutoComplete(read)
  opts.evaluate = opts.evaluate || withSpin(evaluate)

  debug(`opts: `, Object.keys(opts))

  debug(`changing to home directory`)
  await opts.evaluate(ctx, 'cd', [])

  return loop(async function rep() {
    const input = await opts.read(ctx)
    let [cmd, ...cmdArgs] = input.split(' ').filter(Boolean)
    debug(`command: `, cmd, cmdArgs)

    await print(async () => {
      if (!noTiming.includes(cmd) && commands[cmd]) {
        cmdArgs = [cmd, ...cmdArgs]
        cmd = 'time'
      }
      const result = await opts.evaluate(ctx, cmd, cmdArgs)
      if (result && result.ctx) {
        Object.assign(ctx, result.ctx)
      }
      return result
    })
  })
}

const noTiming = ['time', 'clear', 'help']
