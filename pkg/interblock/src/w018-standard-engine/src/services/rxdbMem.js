import assert from 'assert-fast'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core'
import { getRxStorageLoki } from 'rxdb/plugins/lokijs'
addRxPlugin(RxDBDevModePlugin)

export const rxdbmem = async (lockPrefix) => {
  if (!lockPrefix || lockPrefix === 'CI') {
    lockPrefix = 'ci-db'
  } else {
    lockPrefix = 'ci-db-' + lockPrefix.toLowerCase()
  }
  assert(/^[a-z][a-z0-9_$()+/-]*$/.test(lockPrefix), lockPrefix)
  const db = await createRxDatabase({
    name: lockPrefix,
    storage: getRxStorageLoki(),
    multiInstance: false,
  })
  return db
}
