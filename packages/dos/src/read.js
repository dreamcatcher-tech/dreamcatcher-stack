const { prompt } = require('enquirer')
const debug = require('debug')('dos:read')
const chalk = require('ansi-colors')

exports.read = async ({ autoComplete, user, machineId, blockchain }) => {
  const { wd } = blockchain.getContext()
  const identity = `${chalk.green(`${user}@${machineId}`)}`
  const message = `${identity}:${chalk.blue(wd)}${chalk.reset('$')}`

  const question = {
    type: 'input',
    name: 'result',
    message,
    symbols: { prefix: '', separator: '' },
    styles: { success: chalk.noop },
  }
  if (autoComplete) {
    // question.choices = autoComplete.getList()
  }

  const { result } = await prompt(question)
  debug(`prompt result: `, result)
  return result
}
