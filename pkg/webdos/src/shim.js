import process from 'process'
if (!globalThis.process || !globalThis.process.nextTick) {
  // hoist before stream-browserify is loaded
  // hoist before util is loaded
  globalThis.process = process
}
if (!globalThis.global) {
  // hoist before util is loaded
  // hoist before stream-browserify is loaded
  globalThis.global = globalThis
}
