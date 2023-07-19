import delay from 'delay'
import Debug from 'debug'
import assert from 'assert-fast'
const debug = Debug('webdos:Interactions')

export default (steps) =>
  async ({ step }) => {
    assert(Array.isArray(steps), `steps must be an array`)
    assert.strictEqual(typeof step, 'function', `step must be a function`)
    debug('play', steps)
    const start = Date.now()
    while (!globalThis.interpulse) {
      // TODO make a cleaner way to get the nearest engine instance
      await delay(10)
      if (Date.now() - start > 10000) {
        throw new Error(`Interactions: no engine instance found after 10s`)
      }
    }
    for (const action of steps) {
      debug(`executing`, action)
      const { wd = 'NO ENGINE FOUND' } = globalThis.interpulse || {}
      const name = `exec: ${Object.keys(action).join(',')} (wd: ${wd})`
      await step(name, async () => await globalThis.interpulse.execute(action))
    }
  }
