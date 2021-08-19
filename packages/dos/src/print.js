import process from 'process'
import Debug from 'debug'
const debug = Debug('dos:print')

export default async function print(func, stdout, stderr) {
  try {
    let res
    if (typeof func === 'string') {
      res = { out: func }
    } else {
      res = await func()
    }
    if (res && res.out) {
      let string
      if (Object.prototype.toString.call(res.out) === '[object String]') {
        string = res.out
      } else {
        string = JSON.stringify(res.out, null, 2)
      }
      // use cliui to handle string wrapping
      const terminalString = string.replace(/(?:\r\n|\r|\n)/g, '\r\n')
      process.stdout.write(terminalString)
      process.stdout.write('\r\n')
    }
  } catch (err) {
    debug(err)
    process.stderr.write(`❌️ ${err}\r\n`)
  }
}
