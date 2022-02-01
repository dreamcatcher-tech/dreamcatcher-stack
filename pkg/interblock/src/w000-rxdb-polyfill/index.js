/**
 * This polyfill is specific to rxdb.
 */
import process from 'process'
if (!globalThis.process) {
  globalThis.process = process
}
if (!globalThis.global) {
  globalThis.global = globalThis
}
