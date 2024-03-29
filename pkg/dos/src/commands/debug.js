// TODO change the visible logging from within the terminal
import Debug from 'debug'

export const debug = async ({ blockchain }, ...args) => {
  const argsString = args.join(' ')
  const interblockNamespaces = blockchain.logger.Debug.disable()
  const dosShellNamespaces = Debug.disable()
  let out = `current interblock flags: ` + interblockNamespaces
  out += `\ncurrent dos flags: ` + dosShellNamespaces
  out += `\nsetting flags to: ` + argsString
  blockchain.logger.Debug.enable(argsString)
  Debug.enable(argsString)
  // if (localStorage) {
  //   localStorage.debug = argsString
  // }
  return { out }
}

const help = `
Change flags to alter debug output on console.

With no arguments, toggle disable and enable, and will print the currently set flags.
Otherwise will set the current flags.

See https://github.com/visionmedia/debug`
