import Debug from 'debug'
const debug = Debug('dos:commands:error')

let count = 0
export const error = async (ctx, useAwait) => {
  const msg = 'Test Error'
  if (useAwait) {
    debug(`async error test`)
    const bomb = async () => {
      await Promise.resolve()
      throw new Error('async: ' + msg + ' ' + count++)
    }
    return await bomb()
  }
  debug(`sync error test`)
  throw new Error(msg + ' ' + count++)
}

const help = `Throw an error, to test system response`
