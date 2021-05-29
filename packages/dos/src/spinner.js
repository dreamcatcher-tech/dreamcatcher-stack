const ora = require('ora')
const debug = require('debug')('dos:spinner')
exports.withSpin = (fn) => {
  return async function fnWithSpin(ctx) {
    debug(`spinner`)
    ctx.spinner = ora({ spinner: 'moon' }).start()
    try {
      return await fn.apply(this, arguments)
    } catch (e) {
      debug(e)
      throw e
    } finally {
      ctx.spinner.stop()
      ctx.spinner = null
    }
  }
}