import React, { useCallback, useEffect, useId, useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { useResizeDetector } from 'react-resize-detector'
import { Sectors } from './Sectors'
import { Markers } from './Markers'
import { useMap } from './useMap'

const debug = Debug('webdos:components:Map')

export default function MapComponent({ edit, routing, customers, reorder }) {
  const [sector, setSelectedSector] = useState()
  const [mapId, map] = useMap()
  useEffect(() => {
    const selected = routing?.getSelectedChild()
    debug('selected', selected)
    if (!selected) {
      return setSelectedSector()
    }
    if (!routing.isLoadingChildren && routing.hasChild(selected)) {
      const child = routing.getChild(selected)
      return setSelectedSector(child)
    }
  }, [routing])

  const paintBelowAllOthers = 0
  const ensureNotPartOfNormalLayout = 'absolute'
  const mapBackgroundStyle = {
    left: '0px',
    right: '0px',
    top: '0px',
    bottom: '0px',
    position: ensureNotPartOfNormalLayout,
    margin: 0,
    background: 'black',
    zIndex: paintBelowAllOthers,
  }
  const onResize = useCallback(() => map && map.invalidateSize(), [map])
  const { ref } = useResizeDetector({ onResize })

  return (
    <div ref={ref} id={mapId} style={mapBackgroundStyle}>
      <Sectors map={map} routing={routing} edit={edit} />
      <Markers {...{ map, customers, sector, reorder }} />
    </div>
  )
}
MapComponent.propTypes = {
  /**
   * Should the polygons be createable and editable ?
   */
  edit: PropTypes.bool,

  /**
   * Crisp representing the sectors to be displayed on the map
   */
  routing: PropTypes.instanceOf(Crisp),

  /**
   * The customers to be displayed on the map.
   * Implies markers will be shown.
   */
  customers: PropTypes.instanceOf(Crisp),

  /**
   * The modified sector order during editing
   */
  reorder: PropTypes.arrayOf(PropTypes.string),
}
MapComponent.defaultProps = { crisp: Crisp.createLoading() }
