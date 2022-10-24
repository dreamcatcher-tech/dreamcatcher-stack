import React from 'react'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('terminal:widgets:Routing')

/**
 *
 */
const Routing = ({ state, network, actions, wd }) => {
  const title = 'Path' + test
  return (
    <div style={aboveMapStyle}>
      <h2>{title}</h2>
    </div>
  )
}
Routing.propTypes = {
  // this is a test
  test: PropTypes.string,
}
Routing.defaultProps = { test: 'm' }

export default Routing
