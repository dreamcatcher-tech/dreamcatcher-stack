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
import { splitPathSegments } from '../utils'
import posix from 'path'

const debug = Debug(`terminal:useBlockstream`)

export default (cwd) => {
  assert(posix.isAbsolute(cwd), `path must be absolute: ${cwd}`)
  const blocks = usePathBlockstream(cwd)
  const segments = splitPathSegments(cwd)
  const last = blocks.pop()
  return latest
}
