import * as commands from './commands'
import posix from 'path-browserify'
import Debug from 'debug'
const debug = Debug('dos:eval')

export const evaluate = async (ctx, cmd, cmdArgs = []) => {
  debug(`command: `, cmd, cmdArgs)
  cmd = cmd || ''

  if (!cmd) {
    return
  }
  if (!commands[cmd]) {
    const { blockchain } = ctx
    const isResolvable =
      cmd.startsWith('./') || cmd.startsWith('/' || cmd.startsWith('../'))
    if (isResolvable) {
      const { wd } = blockchain
      const absolutePath = posix.resolve(wd, cmd)
      const actionName = posix.basename(absolutePath)
      const parent = posix.dirname(absolutePath)
      debug(`non builtin command: %s assuming covenant function`, actionName)
      const actions = await blockchain.actions(parent)
      debug(`actions`, actions)
      const actionFn = actions[actionName]
      if (actionFn) {
        // TODO decode args into params using commander, minimist, or similar
        return actionFn(...cmdArgs)
      }
    }
    // TODO lookup path for multiple other covenants
    if (blockchain[cmd]) {
      return blockchain[cmd](...cmdArgs)
    }

    throw new Error(`${cmd}: command not found`)
  }

  return commands[cmd](ctx, ...cmdArgs)
}
