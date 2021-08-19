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
    const isLocalCommand =
      cmd.startsWith('./') || cmd.startsWith('/' || cmd.startsWith('../'))
    if (isLocalCommand) {
      // TODO allow remote location at any path to be used as actions
      const { blockchain } = ctx
      const { wd } = blockchain.context()
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
    throw new Error(`${cmd}: command not found`)
  }

  return commands[cmd](ctx, ...cmdArgs)
}
