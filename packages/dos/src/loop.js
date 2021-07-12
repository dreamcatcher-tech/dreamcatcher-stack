const debug = require('debug')('dos:loop')
const setImmediate = require('set-immediate-shim')
module.exports = function loop(func) {
  debug(`begin loop`)
  let isActive = true
  setImmediate(async () => {
    while (isActive) {
      await func()
    }
  })
  return () => {
    isActive = false
    debug(`loop stopped`)
  }
}
