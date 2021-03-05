const debug = require('debug')('dos:eval')
const Commands = require('./commands')

module.exports.evaluate = async (ctx, cmd, cmdArgs = []) => {
  debug(cmd, cmdArgs)
  cmd = cmd || ''

  if (!cmd) {
    return
  }
  if (!Commands[cmd]) {
    if (cmd.startsWith('./')) {
      const actionName = cmd.substring(2)
      debug(`non builtin command: %s assuming covenant function`, actionName)
      const { blockchain } = ctx
      const { wd } = blockchain.getContext()
      const actions = await blockchain.getActionCreators(wd)
      const actionFn = actions[actionName]
      if (actionFn) {
        // TODO decode args into params using commander or similar
        const action = actionFn({ isTestData: true })
        return blockchain.dispatch(action, wd)
      }
    }
    throw new Error(`${cmd}: command not found`)
  }

  return Commands[cmd](ctx, ...cmdArgs)
}
