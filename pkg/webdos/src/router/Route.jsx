import assert from 'assert-fast'
import posix from 'path-browserify'
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useRouter } from '../hooks'
import RouterContext from './RouterContext'

const debug = Debug('webdos:router:Route')
const Route = ({ path, covenant, children }) => {
  debug(`Route path: %s covenant: %s`, path, covenant)
  // path match is when some remains of (cwd - match) === path
  const { matchedPath, pulse } = useRouter()
  assert(posix.isAbsolute(matchedPath), `match not absolute: ${matchedPath}`)

  if (path) {
    let pathTest = path
    if (path.endsWith('*')) {
      // TODO parse globs correctly
      pathTest = path.substring(0, path.length - 1)
    }
    matchedPath = cwd.includes(pathTest)
  }

  if (covenant) {
    const { covenant: toMatch } = pulse.provenance.dmz
    if (covenant === toMatch) {
      return children
    }
  }
}
Route.propTypes = {
  path: PropTypes.string,
  covenant: PropTypes.string,
  children: PropTypes.node,
}

export default Route
