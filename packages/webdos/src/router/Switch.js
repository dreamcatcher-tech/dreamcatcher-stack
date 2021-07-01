/**
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
 */
import React, { useState, useEffect } from 'react'

const Switch = ({ children }) => {
  return children
}

export default Switch
