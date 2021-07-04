const { Input } = require('enquirer-browserify')
const debug = require('debug')('dos:read')
const chalk = require('ansi-colors')
const isNode = require('detect-node')

exports.read = async (
  { autoComplete, user, machineId, blockchain },
  stdin,
  stdout
) => {
  const { wd } = blockchain.getContext()
  const identity = `${chalk.green(`${user}@${machineId}`)}`
  const message = `${identity}:${chalk.blue(wd)}${chalk.reset('$')}`

  const question = {
    type: 'input',
    name: 'result',
    message,
    symbols: { prefix: '', separator: '' },
    styles: { success: chalk.noop },
    stdin,
    stdout,
  }
  if (autoComplete) {
    // question.choices = autoComplete.getList()
  }
  const prompt = new Input(question)
  if (!isNode) {
    prompt.blink = { off: true }
  }
  const result = await prompt.run()
  debug(`prompt result: `, result)
  return result
}
