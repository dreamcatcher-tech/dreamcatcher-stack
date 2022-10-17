/**
 * Used to subscribe directly to the blocks of a given chain.
 * Contrasts to useChannel which offers a lightweight view into a chain
 * for reading limited data, and sending actions in.
 *
 * useBlockstream pulls in the entire block, and fires every time a new block is created.
 * Uses the binary layer to access these blocks.
 * Uses the same underlying methods that the stdengine would apply if the same
 * commands were called from inside a chain.
 *
 * If there is no path or we have no permissions, it returns `undefined` and
 * continues to try.
 */
import assert from 'assert-fast'
import { default as usePathBlockstream } from './usePathBlockstream'
import Debug from 'debug'
import posix from 'path-browserify'

const debug = Debug(`terminal:useBlockstream`)

export default (path) => {
  assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
  const pulses = usePathBlockstream(path)
  return pulses[path]
}
