import React from 'react'
import Debug from 'debug'
import { useRouter } from '../hooks'
const debug = Debug('terminal:widgets:Services')

/**
 * Uses the data in the customer collection to generate a list of affected customers given a date.
 * Special in that it needs to generate the data it displays, rather than altering any state in chain land.  This data streams in as it is calculated, rather than waiting for the lengthy calculation to complete.
 * Once a date has passed, a snapshot of this day is stored in the "services" chain.
 * Shows a list of customers in order for a given date.
 * A local cache may be store don the users chain
 */

const Schedule = () => {
  const { matchedPath, pulse } = useRouter()
  const title = 'Sites'
  const description = 'Geography of sites'
  const aboveMapStyle = { position: 'relative', pointerEvents: 'none' }
  const hideMapBackgrond = {
    position: 'absolute', // hits top of the map background container
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    background: 'white',
  }
  return (
    <div style={hideMapBackgrond}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

export default Schedule
