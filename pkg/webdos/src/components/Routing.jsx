import { api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  SorterDatum,
  Map,
  RoutingSpeedDial,
  SectorSelector,
  Datum,
  Glass,
} from '.'

const debug = Debug('terminal:widgets:Routing')

const Routing = ({ complex, selected: initialSelected }) => {
  const onCreate = () => {}
  const onEdit = () => {}
  const [sector, onSelected] = useState(initialSelected)
  const [marker, onMarker] = useState()
  const sectorComplex = complex.hasChild(sector)
    ? complex.child(sector)
    : undefined
  if (!sectorComplex && complex.network.length) {
    onSelected(complex.network[0].path)
  }
  const onSector = onSelected
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <SectorSelector {...{ complex, selected: sector, onSelected }} />
          {sectorComplex && (
            <>
              <Datum complex={sectorComplex} collapsed />
              <SorterDatum
                {...{
                  complex: sectorComplex,
                  selected: marker,
                  onSelected: onMarker,
                }}
              />
            </>
          )}
        </Glass.Left>
      </Glass.Container>
      <RoutingSpeedDial></RoutingSpeedDial>
      <Map
        {...{
          onCreate,
          onEdit,
          complex,
          onSector,
          selected: sector,
          onMarker,
          marker,
        }}
        markers
      />
    </>
  )
}
Routing.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  selected: PropTypes.string,
}

export default Routing
