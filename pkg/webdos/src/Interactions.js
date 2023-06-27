import delay from 'delay'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('webdos:Interactions')

export default (steps) =>
  async ({ step }) => {
    assert(Array.isArray(steps), `steps must be an array`)
    assert.strictEqual(typeof step, 'function', `step must be a function`)
    debug('play', steps)
    while (!globalThis.interpulse) {
      // TODO make a cleaner way to get the nearest engine instance
      await delay(10)
    }
    for (const action of steps) {
      debug(`executing`, action)
      const { wd } = globalThis.interpulse
      const name = `exec: ${Object.keys(action).join(',')} (wd: ${wd})`
      await step(name, async () => await globalThis.interpulse.execute(action))
    }
  }
