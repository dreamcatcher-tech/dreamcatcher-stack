const Chalk = require('ansi-colors')
const debug = require('debug')('dos:print')

module.exports = async function print(func, stdout, stderr) {
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
      stdout.write(terminalString)
      stdout.write('\r\n')
    }
  } catch (err) {
    debug(err)
    stderr.write(`❌️ ${err}\r\n`)
  }
}
