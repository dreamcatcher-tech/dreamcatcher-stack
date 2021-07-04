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
const debug = Debug('webdos:router:Switch')

const Switch = ({ children }) => {
  children = Array.isArray(children) ? children : [children]
  children = children.filter((child) => child.type === Route)
  debug(`found routes: ${children.length}`)
  const { context, blockchain } = useBlockchain()
  const path = context.wd
  debug(`path`, path)
  // redraw whenever the path blocks change in case we need to switch different ?
  const blocks = usePathBlockstream(path)

  for (const child of children) {
    // get the current path we are in
    if (child.props.covenant) {
      // walk all blocks
    }
  }

  return children
}

export default Switch
