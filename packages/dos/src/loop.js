import setImmediate from 'set-immediate-shim'
import Debug from 'debug'
const debug = Debug('dos:loop')

export default function loop(func) {
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
