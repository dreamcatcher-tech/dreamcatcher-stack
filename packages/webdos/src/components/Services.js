import React from 'react'
import Debug from 'debug'

const debug = Debug('terminal:widgets:Services')

const Services = () => {
  // const { state } = block
  // debug(`state`, state)
  // const { title, description } = state.formData
  const title = 'Services'
  const description = 'Services Description'
  const aboveMapStyle = { position: 'relative', pointerEvents: 'none' }
  return (
    <div style={aboveMapStyle}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

export default Services
