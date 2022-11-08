import { api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import * as React from 'react'
import PropTypes from 'prop-types'
import { Map, RoutingSpeedDial, SectorSelector, Datum } from '.'
import { Card, CardHeader, CardContent, Typography } from '@mui/material'

const debug = Debug('terminal:widgets:Routing')

const Routing = ({ complex }) => {
  const onCreate = () => {}
  const onEdit = () => {}
  const [selected, onSelected] = React.useState()
  let sector = complex.hasChild(selected) ? complex.child(selected) : null
  if (!sector && complex.network.length) {
    onSelected(complex.network[0].path)
  }
  if (sector) {
    const { state } = sector
    const { formData: withGeometry } = state
    const formData = { ...withGeometry }
    delete formData.geometry
    sector = sector.setState({ ...state, formData })
  }
  const datum = sector ? <Datum complex={sector} /> : <NotSelected />
  return (
    <>
      <Map {...{ onCreate, onEdit }}>
        <SectorSelector {...{ complex, selected, onSelected }} />
        {datum}
      </Map>
      <RoutingSpeedDial></RoutingSpeedDial>
    </>
  )
}
Routing.propTypes = { complex: PropTypes.instanceOf(api.Complex).isRequired }

const NotSelected = () => {
  return (
    <Card>
      <CardHeader title="No sector selected" />
      <CardContent>
        <Typography>Select a sector to see details.</Typography>
      </CardContent>
    </Card>
  )
}

export default Routing
