import assert from 'assert-fast'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core'
import { getRxStorageLoki } from 'rxdb/plugins/lokijs'
import liia from 'lokijs/src/incremental-indexeddb-adapter'
// import { getRxStoragePouch, addPouchPlugin } from 'rxdb/plugins/pouchdb'
// import panw from 'pouchdb-adapter-node-websql'
// import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import lfsa from 'lokijs/src/loki-fs-structured-adapter'
import makedirp from 'make-dir'

// import pal from 'pouchdb-adapter-leveldb'
// import leveldown from 'leveldown'

import isBrowser from 'is-in-browser'
import Debug from 'debug'
const debug = Debug('interblock:emulators:rxdbFactory')

const createRxdb = async (name) => {
  assert.strictEqual(typeof name, 'string')
  if (!name) {
    return
  }
  // addRxPlugin(RxDBDevModePlugin)
  // addRxPlugin(RxDBQueryBuilderPlugin)
  assert(/^[a-z][a-z0-9_$()+/-]*$/.test(name), `invalid path: ${name}`)
  if (isBrowser) {
    const rxdb = await createRxDatabase({
      name,
      storage: getRxStorageLoki({ adapter: new liia() }),
      multiInstance: true,
    })
    return rxdb
  } else {
    // addPouchPlugin(panw)
    const dir = 'lokidb/'
    await makedirp(dir)
    name = dir + name
    console.log('creating database:', name)
    const rxdb = await createRxDatabase({
      name,
      storage: getRxStorageLoki({ adapter: new lfsa() }),
      multiInstance: false,
    })
    return rxdb
  }
}

export { createRxdb }
