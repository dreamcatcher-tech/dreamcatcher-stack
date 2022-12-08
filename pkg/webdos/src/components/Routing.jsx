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

const Routing = ({ complex, sector: initialSector }) => {
  const onCreate = () => {}
  const onEdit = () => {}
  const [sector, onSector] = useState(initialSector)
  const [marker, setMarker] = useState()
  const [order, onOrder] = useState() // the dynamic changing data
  const onMarker = (marker) =>
    setMarker((current) => {
      debug('onMarker', current, marker)
      if (current === marker) {
        return undefined
      }
      return marker
    })
  const sectorComplex = complex.hasChild(sector)
    ? complex.child(sector)
    : undefined
  if (!sectorComplex && complex.network.length) {
    onSector(complex.network[0].path)
  }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <SectorSelector {...{ complex, sector, onSector }} />
          {sectorComplex && (
            <>
              <Datum complex={sectorComplex} collapsed />
              <SorterDatum
                complex={sectorComplex}
                marker={marker}
                onMarker={onMarker}
                onOrder={onOrder}
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
          sector,
          onMarker,
          marker,
          order,
        }}
        markers
      />
    </>
  )
}
Routing.propTypes = {
  /**
   * The Routing complex
   */
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  /**
   * Used only in testing
   * The selected sector path
   */
  sector: PropTypes.string,
}

export default Routing
