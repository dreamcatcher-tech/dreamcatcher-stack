import { Crisp } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import React, { useState, useRef } from 'react'
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

const Routing = ({ crisp }) => {
  debug('crisp', crisp)
  const sector = crisp.getSelectedChild()
  const [marker, setMarker] = useState()
  const [order, onOrder] = useState() // the dynamic changing data
  const [isEditingSector, setIsEditingSector] = useState(false)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const disabled = isEditingSector || isEditingOrder
  const onMarker = (marker) =>
    setMarker((current) => {
      debug('onMarker', current, marker)
      if (current === marker) {
        return undefined
      }
      return marker
    })
  const disabledRef = useRef()
  disabledRef.current = disabled
  const onSector = (sector) => {
    debug('onSector', sector)
    if (!disabledRef.current && !crisp.isLoadingActions) {
      const path = crisp.absolutePath + '/' + sector
      debug('onSector path', path)
      const promise = crisp.actions.cd(path)
    }
  }
  const sectorCrisp = sector && crisp.hasChild(sector) && crisp.getChild(sector)
  if (!sectorCrisp && !crisp.isLoading && crisp.sortedChildren.length) {
    onSector(crisp.sortedChildren[0])
  }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <SectorSelector {...{ crisp, sector, onSector, disabled }} />
          {sectorCrisp && (
            <>
              <Datum
                complex={sectorCrisp}
                collapsed
                onEdit={setIsEditingSector}
                viewOnly={isEditingOrder}
              />
              <SorterDatum
                complex={sectorCrisp}
                marker={marker}
                onMarker={onMarker}
                onOrder={onOrder}
                onEdit={setIsEditingOrder}
                viewOnly={isEditingSector}
              />
            </>
          )}
        </Glass.Left>
      </Glass.Container>
      <RoutingSpeedDial></RoutingSpeedDial>
      <Map
        {...{
          crisp,
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
   * The Routing node
   */
  crisp: PropTypes.instanceOf(Crisp),
}

export default Routing
