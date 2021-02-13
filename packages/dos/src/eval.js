const debug = require('debug')('dos:eval')
const Commands = require('./commands')

module.exports.evaluate = (ctx, cmd, cmdArgs = []) => {
  debug(cmd, cmdArgs)
  cmd = cmd || ''

  if (!cmd) return
  if (!Commands[cmd]) throw new Error(`${cmd}: command not found`)

  return Commands[cmd](ctx, ...cmdArgs)
}
