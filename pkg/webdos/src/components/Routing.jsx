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

const Routing = ({ crisp, customers }) => {
  const path = crisp.getSelectedChild()
  const [isDefaultSet, setIsDefaultSet] = useState(!!path)
  const [isUpdating, setIsUpdating] = useState(false)
  const [reorder, onReorder] = useState([])
  const [isEditingSector, setIsEditingSector] = useState(false)
  const [isEditingOrder, setIsEditingOrder] = useState(false)
  const disabled = isEditingSector || isEditingOrder || isUpdating

  if (!isDefaultSet) {
    if (!crisp.isLoadingChildren) {
      if (crisp.wd.startsWith(crisp.path)) {
        if (crisp.sortedChildren.length) {
          if (!path) {
            const [first] = crisp.sortedChildren
            const path = crisp.absolutePath + '/' + first
            debug('selecting first sector', path)
            const allowVirtual = true
            crisp.actions.cd(path, allowVirtual)
            setIsDefaultSet(true)
          }
        }
      }
    }
  }

  const sector = path && crisp.hasChild(path) && crisp.getChild(path)

  const onUpdate = async () => {
    debug('onUpdate')
    setIsUpdating(true)
    const result = await crisp.actions.update()
    debug('onUpdate result', result)
    // TODO give some progress on update running
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
                onOrder={onReorder}
                onEdit={setIsEditingOrder}
                customers={customers}
              />
            </>
          )}
        </Glass.Left>
      </Glass.Container>
      <RoutingSpeedDial disabled={dialDisabled} onUpdate={onUpdate} />
      <Map routing={crisp} customers={customers} reorder={reorder} />
    </>
  )
}
Routing.propTypes = {
  /**
   * The Routing node
   */
  crisp: PropTypes.instanceOf(Crisp),
  /**
   * The customers Crisp
   */
  customers: PropTypes.instanceOf(Crisp),
}

export default Routing
