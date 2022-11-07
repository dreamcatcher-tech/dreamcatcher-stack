import Complex from '../Complex'
import Debug from 'debug'
import React from 'react'
import PropTypes from 'prop-types'
import { Map, RoutingSpeedDial, SectorSelector } from '.'
import { Card, CardContent, Stack } from '@mui/material'

const debug = Debug('terminal:widgets:Routing')

const Routing = ({ complex }) => {
  const onCreate = () => {}
  const onEdit = () => {}

  return (
    <>
      <Map {...{ onCreate, onEdit }}>
        <SectorSelector complex={complex} />
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
Routing.propTypes = { complex: PropTypes.instanceOf(Complex).isRequired }

export default Routing
