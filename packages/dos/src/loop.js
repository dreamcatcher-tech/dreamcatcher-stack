const debug = require('debug')('dos:loop')
module.exports = async function loop(func) {
  while (true) {
    await func()
  }
}
