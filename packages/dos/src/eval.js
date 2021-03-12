const debug = require('debug')('dos:eval')
const Commands = require('./commands')

module.exports.evaluate = async (ctx, cmd, cmdArgs = []) => {
  debug(cmd, cmdArgs)
  cmd = cmd || ''

  if (!cmd) {
    return
  }
  if (!Commands[cmd]) {
    const isLocalCommand =
      cmd.startsWith('./') || cmd.startsWith('/' || cmd.startsWith('../'))
    if (isLocalCommand) {
      // TODO allow remote location at any path to be used as actions
      const actionName = cmd.substring(2)
      debug(`non builtin command: %s assuming covenant function`, actionName)
      const { blockchain } = ctx
      const { wd } = blockchain.getContext()
      const actions = await blockchain.getActionCreators(wd)
      const actionFn = actions[actionName]
      if (actionFn) {
        // TODO decode args into params using commander or similar
        const action = actionFn({
          isTestData: true,
          // formData: { firstName: 'testing' },
        })
        return blockchain.dispatch(action, wd)
      }
    }
    throw new Error(`${cmd}: command not found`)
  }

  return Commands[cmd](ctx, ...cmdArgs)
}
