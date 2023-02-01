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
import assert from 'assert-fast'

const debug = Debug('terminal:widgets:Routing')

const Routing = ({ crisp }) => {
  const sector = crisp.getSelectedChild()
  const [marker, setMarker] = useState()
  const [order, onOrder] = useState() // the dynamic changing data
  const [isEditingSector, setIsEditingSector] = useState(false)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const disabled = isEditingSector || isEditingOrder
  const disabledRef = useRef()
  disabledRef.current = disabled
  const onSector = (sector) => {
    debug('onSector', sector)
    if (!disabledRef.current && !crisp.isLoadingActions) {
      assert(crisp.hasChild(sector), `crisp has no child ${sector}`)
      const path = crisp.absolutePath + '/' + sector
      debug('onSector path', path)
      const promise = crisp.actions.cd(path)
    }
  }
  const sectorCrisp = sector && crisp.hasChild(sector) && crisp.getChild(sector)
  if (!sectorCrisp && !crisp.isLoading && crisp.sortedChildren.length) {
    const firstName = crisp.sortedChildren[0]
    debug('selecting first sector', firstName)
    const first = crisp.getChild(firstName)
    if (!first.isLoading) {
      onSector(firstName)
    }
  }
  return (
    <>
      <Glass.Container>
        <Glass.Left>
          <SectorSelector {...{ crisp, sector, onSector, disabled }} />
          {sectorCrisp && (
            <>
              <Datum
                crisp={sectorCrisp}
                collapsed
                onEdit={setIsEditingSector}
                viewOnly={isEditingOrder}
              />
              <SorterDatum
                crisp={sectorCrisp}
                viewOnly={isEditingSector}
                onOrder={onOrder}
                onEdit={setIsEditingOrder}
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
