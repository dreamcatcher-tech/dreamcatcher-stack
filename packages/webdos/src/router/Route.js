import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useBlockchain } from '..'
const debug = Debug('webdos:router:Route')
/**
 * ## Matching on covenant
 * Renders based on the earliest match
 *
 *
 * @param {*} param0
 * @returns
 */
const Route = ({ covenant, component, children }) => {
  debug(`children`, children)
  const { blockchain } = useBlockchain()

  // find out what part of the path we matched on

  return <>{children}</>
}
Route.propTypes = {
  covenant: PropTypes.string,
  component: PropTypes.element,
}

export default Route
