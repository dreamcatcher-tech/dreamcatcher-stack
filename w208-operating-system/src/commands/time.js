const pretty = require('pretty-ms')
const debug = require('debug')('dos-shell:commands:time')

module.exports = async (ctx, ...args) => {
  const { evaluate } = require('../eval')
  // TODO handle nested and remote paths

  if (args.length < 1) {
    throw new Error('Must supply command')
  }
  const [command, ...rest] = args
  debug(`time: `, command, rest)
  const start = Date.now()
  const res = (await evaluate(ctx, command, rest)) || {}
  res.out = res.out || ''
  res.out = res.out + `\nTime: ${pretty(Date.now() - start)}`
  return res
}

module.exports.help = `
Measure how long a command takes.
`
