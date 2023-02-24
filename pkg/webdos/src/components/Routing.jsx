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
  const path = crisp.getSelectedChild()
  const [isUpdating, setIsUpdating] = useState(false)
  const [order, onOrder] = useState() // the dynamic changing data
  const [isEditingSector, setIsEditingSector] = useState(false)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const disabled = isEditingSector || isEditingOrder || isUpdating
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

  const sector = path && crisp.hasChild(path) && crisp.getChild(path)
  if (!sector && !crisp.isLoadingActions && crisp.sortedChildren.length) {
    debug('no sector selected', crisp)
    if (crisp.wd.startsWith(crisp.path)) {
      const [first] = crisp.sortedChildren
      debug('selecting first sector', first)
      const firstChild = crisp.getChild(first)
      if (!firstChild.isLoading) {
        onSector(first)
      }
    }
  }

  const onUpdate = async () => {
    debug('onUpdate')
    setIsUpdating(true)
    const result = await crisp.actions.update()
    debug('onUpdate result', result)
    setIsUpdating(false)
  }
  const dialDisabled = disabled || crisp.isLoadingActions
  return (
    <>
      <Glass.Container>
        <Glass.Left min={!sector}>
          <SectorSelector crisp={crisp} disabled={disabled} />
          {sector && (
            <>
              <Datum
                crisp={sector}
                collapsed
                onEdit={setIsEditingSector}
                viewOnly={isEditingOrder}
              />
              <SorterDatum
                crisp={sector}
                viewOnly={isEditingSector}
                onOrder={onOrder}
                onEdit={setIsEditingOrder}
              />
            </>
          )}
        </Glass.Left>
      </Glass.Container>
      <RoutingSpeedDial disabled={dialDisabled} onUpdate={onUpdate} />
      <Map crisp={crisp} order={order} markers />
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
