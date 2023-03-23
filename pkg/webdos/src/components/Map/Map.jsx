import React, { useCallback, useEffect, useId, useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import L from '../leaflet'
import Debug from 'debug'
import { useResizeDetector } from 'react-resize-detector'
import { Sectors } from './Sectors'
import { Markers } from './Markers'

const debug = Debug('webdos:components:Map')
const maxNativeZoom = 18
const maxZoom = 22

export default function MapComponent({ edit, routing, customers, reorder }) {
  const mapId = useId()
  const [map, setMap] = useState()
  const [sector, setSelectedSector] = useState()
  useEffect(() => {
    L.Browser.touch = false
    const mapOptions = {
      center: [-37.76976, 175.27605],
      zoom: 12,
      bounceAtZoomLimits: true,
      zoomControl: false,
      attributionControl: false,
      controls: {
        layers: {
          visible: true,
          position: 'topright',
          collapsed: true,
        },
      },
      doubleClickZoom: true,
      boxZoom: false,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 350,
      pmIgnore: false,
      preferCanvas: false,
    }
    debug('creating map')
    const _map = L.map(mapId, mapOptions)
    const zoomControl = L.control.zoom({ position: 'topright' })

    const scaleOptions = { position: 'topright' }
    const scale = L.control.scale(scaleOptions)
    const baseLayers = {
      HEREMaps: L.tileLayer.provider('HEREv3.hybridDay', {
        apiKey: 'BEHrpff8e5pVCFRntmhH4yk8XBSnijsOOSy1Hsi0BnY',
      }),
      OpenStreetMap: L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxNativeZoom: maxNativeZoom,
          maxZoom,
        }
      ),
    }
    baseLayers.HEREMaps.addTo(_map)

    const overlays = {}
    const layerConfig = {
      position: 'topright',
      collapsed: true,
      hideSingleBase: false,
    }

    const layerControl = L.control.layers(baseLayers, overlays, layerConfig)

    _map.on('zoomend', (event) => {
      debug('zoomend', _map.getZoom())
    })

    scale.addTo(_map)
    layerControl.addTo(_map)
    zoomControl.addTo(_map)

    debug('map created')
    setMap(_map)

    return () => {
      debug('removing map')
      _map.isRemoved = true
      _map.remove()
    }
  }, [])

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
