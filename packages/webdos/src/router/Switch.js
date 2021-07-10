/**
 * Renders the first Route within its direct children that matches.
 *
 *
 * ? do we need our own lib, or can we use react-router directly ?
 * possibly fork it, so we use some of its base components, and override some ?
 *
 * Must repond to route changes, but also look at covenants to choose component.
 * Must render for the full path, and for each one, we look to the covenants.
 * Allow overloads of some paths.
 * ? select a component based on a covenant match
 *
 * Renders everything along the path, which allows some children to overdraw parents
 * Deeply nested paths, which child switches.
 * ? Could do relativePath and path to specify when nested ?
 * or any nested component represents a nested path, and so match must be prefixed
 * with the parents path for the match to trigger
 *
 * We need model of multiple matches.
 * If Datums could be linked to templates, then we could render base on that ?
 * Allow a default where we make a selection based on covenant type ?
 * Some ui is specified by the uiSchema field, so we can select standard components ?
 *
 * exact: path must fully match, exactly
 *
 * Render placeholders while children may still be pulling in data.
 *
 *
 *
 *
 *
 */
import React, { useState, useEffect } from 'react'
import Debug from 'debug'
import { Route, useBlockchain, usePathBlockstream } from '..'
import assert from 'assert'
import RouterContext from './RouterContext'
import { splitPathSegments } from '../utils'

const debug = Debug('webdos:router:Switch')

const Switch = ({ children }) => {
  children = React.Children.toArray(children)
  const routes = children.filter((child) => child.type === Route)
  debug(`found routes: ${routes.length}`)
  assert.strictEqual(children.length, routes.length)
  const { context } = useBlockchain()
  const cwd = context.wd // TODO allow nested switch, so pull relative path
  debug(`cwd`, cwd)
  const segments = splitPathSegments(cwd)

  const blocks = usePathBlockstream(cwd)
  debug(`blocks length`, blocks.length)

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
  for (const route of routes) {
    const { covenant } = route.props
    if (covenant) {
      const matchedBlock = blocks.find(
        (block) => block.covenantId.name === covenant
      )
      if (matchedBlock) {
        const index = blocks.indexOf(matchedBlock)
        debug(`matched `, covenant, index)
        // set context provider so useRouteMatch can get the matching info
        // useRouteBlock() to get the blocks in the current matched path ?
        return wrapRoute(route, index)
      }
    }
    const { path } = route.props
    if (path) {
      debug(`route path: `, path)
      if (cwd.includes(path)) {
        const lastSegment = path.split('/').pop()
        const index = segments.lastIndexOf(lastSegment)
        assert(index >= 0, `Index not found: ${path}`)
        return wrapRoute(route, index)
      }
    }
  }

  return null
}

export default Switch
