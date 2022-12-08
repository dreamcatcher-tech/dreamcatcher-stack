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
  const [formData, onChange] = useState() // the dynamic changing data
  const onMarker = (marker) =>
    setMarker((current) => {
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
          <SectorSelector
            {...{ complex, selected: sector, onSelected: onSector }}
          />
          {sectorComplex && (
            <>
              <Datum complex={sectorComplex} collapsed />
              <SorterDatum
                complex={sectorComplex}
                selected={marker}
                onSelected={onMarker}
                onChange={onChange}
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
          sorted: formData,
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
