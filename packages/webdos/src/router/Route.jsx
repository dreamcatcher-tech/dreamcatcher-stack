import {assert} from 'chai/index.mjs'
import posix from 'path-browserify'
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useRouter } from '../hooks'
import RouterContext from './RouterContext'

const debug = Debug('webdos:router:Route')
/**
 * ## Matching on covenant
 * Renders based on the earliest match
 *
 *
 * @param {*} param0
 * @returns
 */
const Route = ({ path, covenant, component, children }) => {
  debug(
    `Route path: %s covenant: %s component: %s children: %s`,
    path,
    covenant,
    !!component,
    !!children
  )
  const context = useRouter()

  // check if our path matches, and if we should render at all
  const { blocks, match, cwd } = context
  // path match is when some remains of (cwd - match) === path
  // assert(posix.isAbsolute(match), `match not absolute: ${match} ${cwd}`)
  assert(posix.isAbsolute(cwd), `cwd not absolute: ${match} ${cwd}`)
  assert(Array.isArray(blocks))

  let matchedCovenant = false,
    matchedPath = false
  if (path) {
    let pathTest = path
    if (path.endsWith('*')) {
      // TODO parse globs correctly
      pathTest = path.substring(0, path.length - 1)
    }
    matchedPath = cwd.includes(pathTest)
  }
  debug(`matchedPath: %o matchedCovenant: %o`, matchedPath, matchedCovenant)
  // TODO check if covenant is matched by using code from Switch
  matchedCovenant = !!covenant

  if (!matchedPath && !matchedCovenant) {
    debug(`no match`, path)
    return null
  }
  debug(`match found`, path, covenant)

  // TODO wrap in a routerProvider, rather than injecting props
  const wrapRoute = (route, index) => {
    const matchedBlocks = blocks.slice(index)
    const match = segments
      .slice(0, index + 1)
      .join('/')
      .substring(1)
    debug(`matchedPath`, match)
    return (
      <RouterContext.Provider value={{ blocks: matchedBlocks, match, cwd }}>
        {route}
      </RouterContext.Provider>
    )
  }
  let result

  if (component) {
    const nextChildren = [
      ...React.Children.toArray(component.props.children),
      ...React.Children.toArray(children),
    ]
    result = React.cloneElement(component, context, nextChildren)
  } else {
    result = (
      <>
        {React.Children.map(children, (child) => {
          return React.cloneElement(child, context)
        })}
      </>
    )
  }
  return result
}
Route.propTypes = {
  path: PropTypes.string,
  covenant: PropTypes.string,
  component: PropTypes.element,
}

export default Route
