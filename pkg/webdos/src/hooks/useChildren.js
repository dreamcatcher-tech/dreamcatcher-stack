import assert from 'assert-fast'
import { default as usePathBlockstream } from './usePathBlockstream'
import Debug from 'debug'
import { splitPathSegments } from '../utils'
import posix from 'path'
import { useState } from 'react'

const debug = Debug(`terminal:useBlockstream`)
/**
 * Gets the children for a given path
 */
export default (cwd) => {
  assert(posix.isAbsolute(cwd), `path must be absolute: ${cwd}`)
  const [children, setChildren] = useState({})
}
