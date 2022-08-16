if (!globalThis.global) {
  // the mortice package in ipfs-core has not been updated yet.
  // it requires this shim, but once updated, this can be removed.
  // globalThis.global = globalThis
}
