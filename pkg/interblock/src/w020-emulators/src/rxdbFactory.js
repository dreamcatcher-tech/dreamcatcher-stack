import assert from 'assert-fast'
import isBrowser from 'is-in-browser'
import Debug from 'debug'
const debug = Debug('interblock:emulators:rxdbFactory')

const createRxdb = (path) => {
  assert.strictEqual(typeof path, 'string')
  if (!path) {
    return
  }
  if (isBrowser) {
    // use indexedDb loki
    // check the loki adapter
  } else {
    // use permanent storage
    // assert path is a directory that exists
    // check the loki adapter
  }
}

export { createRxdb }
