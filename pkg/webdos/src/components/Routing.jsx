import Debug from 'debug'
import React from 'react'
import PropTypes from 'prop-types'
import { Map, RoutingSpeedDial, SectorSelector } from '.'
import { Card, CardContent, Stack } from '@mui/material'

const debug = Debug('terminal:widgets:Routing')

const Routing = ({}) => {
  const onCreate = () => {}
  const onEdit = () => {}

  return (
    <>
      <Map {...{ onCreate, onEdit }}>
        <SectorSelector selected="meow" />
        <Card sx={{ minWidth: 245 }}>
          <CardContent>
            <div>Sector Datum</div>
          </CardContent>
        </Card>
        <Card sx={{ minWidth: 245 }}>
          <CardContent>
            <div>Datum with edit controls for sequencing</div>
            <div>list of all locations in order</div>
          </CardContent>
        </Card>
      </Map>
      <RoutingSpeedDial></RoutingSpeedDial>
    </>
  )
}
Routing.propTypes = {}
Routing.defaultProps = {}

export default Routing
