import assert from 'assert'
import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useBlockchain } from '..'
import { useRouterContext } from './RouterContext'

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
  debug(`children`, !!children)
  const context = useRouterContext()

  // check if our path matches, and if we should render at all
  const { cwd, match } = context
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

  if (component) {
    const nextChildren = [
      ...React.Children.toArray(component.props.children),
      ...React.Children.toArray(children),
    ]
    return React.cloneElement(component, context, nextChildren)
  }

  return (
    <>
      {React.Children.map(children, (child) => {
        return React.cloneElement(child, context)
      })}
    </>
  )
}
Route.propTypes = {
  path: PropTypes.string,
  covenant: PropTypes.string,
  component: PropTypes.element,
}

export default Route
