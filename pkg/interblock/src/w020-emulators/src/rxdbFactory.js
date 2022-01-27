import assert from 'assert-fast'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core'
import { getRxStorageLoki } from 'rxdb/plugins/lokijs'
import LokiIncrementalIndexedDBAdapter from 'lokijs/src/incremental-indexeddb-adapter'

import isBrowser from 'is-in-browser'
import Debug from 'debug'
const debug = Debug('interblock:emulators:rxdbFactory')
addRxPlugin(RxDBDevModePlugin)

const createRxdb = async (name) => {
  assert.strictEqual(typeof name, 'string')
  if (!name) {
    return
  }
  assert(/^[a-z][a-z0-9_$()+/-]*$/.test(name), `invalid path: ${name}`)
  if (isBrowser) {
    // use indexedDb loki
    // check the loki adapter

    const rxdb = await createRxDatabase({
      name,
      storage: getRxStorageLoki({
        adapter: new LokiIncrementalIndexedDBAdapter(),
      }),
      multiInstance: true,
    })
    return rxdb
  } else {
    // use permanent storage
    // assert path is a directory that exists
    // check the loki adapter
  }
}

export { createRxdb }
