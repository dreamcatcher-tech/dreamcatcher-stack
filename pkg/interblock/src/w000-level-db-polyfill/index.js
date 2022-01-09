/**
 * These polyfills are specific to levelup.
 * In particular its reliance on the 'util' package.
 */
import process from 'process'
import { Buffer } from 'buffer'
if (!globalThis.process) {
  globalThis.process = process
}
if (!globalThis.global) {
  globalThis.global = globalThis
}
if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer
}
