import Debug from 'debug'
const debug = Debug('dos:loop')

export default function loop(func) {
  debug(`begin loop`)
  let isActive = true
  setTimeout(async () => {
    while (isActive) {
      await func()
    }
  })
  return () => {
    isActive = false
    debug(`loop stopped`)
  }
}
