const { prompt } = require('enquirer')
const debug = require('debug')('dos:read')
const chalk = require('ansi-colors')

exports.read = async ({ autoComplete, user, machineId, blockchain }) => {
  const { wd } = blockchain.getContext()
  const message = `${chalk.green(`${user}@${machineId}`)}:${chalk.blue(wd)}$`
  debug(`reading: ${message}`)

  const question = {
    type: 'input',
    name: 'result',
    message,
  }
  if (autoComplete) {
    // question.choices = autoComplete.getList()
  }

  const { result } = await prompt(question)
  debug(`prompt result: `, result)
  return result
}
