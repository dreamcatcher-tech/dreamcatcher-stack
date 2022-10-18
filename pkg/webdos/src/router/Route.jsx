import assert from 'assert-fast'
import posix from 'path-browserify'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useRouter, useBlockchain, usePathBlockstream } from '../hooks'
import RouterContext from './RouterContext'
import React from 'react'

const debug = Debug('webdos:router:Route')
const Route = ({ path, covenant, children }) => {
  debug(`Route path: %s covenant: %s`, path, covenant)
  // path match is when some remains of (cwd - match) === path
  const { matchedPath, pulse } = useRouter()
  assert(posix.isAbsolute(matchedPath), `match not absolute: ${matchedPath}`)
  const { wd } = useBlockchain()
  const latests = usePathBlockstream(wd)

  if (path) {
    let pathTest = path
    if (path.endsWith('*')) {
      // TODO parse globs correctly
      pathTest = path.substring(0, path.length - 1)
    }
    if (wd.includes(pathTest)) {
      debug('path match found', pathTest, wd)
      for (const matchedPath of Object.keys(latests)) {
        if (matchedPath.includes(pathTest)) {
          const matchedCovenant = ''
          const pulse = latests[matchedPath]
          return wrapChildren(children, matchedPath, matchedCovenant, pulse)
        }
      }
    }
  }

  if (covenant) {
    const { covenant: toMatch } = pulse.provenance.dmz
    if (covenant === toMatch) {
      return wrapChildren(children, matchedPath, covenant, pulse)
    }
  }
}
Route.propTypes = {
  path: PropTypes.string,
  covenant: PropTypes.string,
  children: PropTypes.node,
}
const wrapChildren = (children, matchedPath, matchedCovenant, pulse) => {
  assert(pulse)
  return (
    <RouterContext.Provider value={{ matchedPath, matchedCovenant, pulse }}>
      {children}
    </RouterContext.Provider>
  )
}

export default Route
