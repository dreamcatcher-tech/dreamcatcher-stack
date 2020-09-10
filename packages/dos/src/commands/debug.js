// TODO change the visible logging from within the terminal
const debug = require('debug')

module.exports = async ({ blockchain }, ...args) => {
  const argsString = args.join(' ')
  const interblockNamespaces = blockchain._debug.disable()
  const dosShellNamespaces = debug.disable()
  let out = `current interblock flags: ` + interblockNamespaces
  out += `\ncurrent dos flags: ` + dosShellNamespaces
  out += `\nsetting flags to: ` + argsString
  blockchain._debug.enable(argsString)
  debug.enable(argsString)
  return { out }
}

module.exports.help = `
Change flags to alter debug output on console.

With no arguments, toggle disable and enable, and will print the currently set flags.
Otherwise will set the current flags.

See https://github.com/visionmedia/debug`
