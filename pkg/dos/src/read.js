import Enquirer from 'enquirer-browserify'
import chalk from 'ansi-colors-browserify'
import isNode from 'detect-node'
import Debug from 'debug'
const debug = Debug('dos:read')
const { Input } = Enquirer
export const read = async (
  { autoComplete, user, machineId, blockchain },
  stdin,
  stdout
) => {
  const { wd } = blockchain.context()
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
