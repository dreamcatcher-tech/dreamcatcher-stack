import React, { useEffect, useId } from 'react'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'
Debug.enable('*Gps')
const debug = Debug('webdos:components:Gps')
const maxNativeZoom = 18
const maxZoom = 22
/**
 * Allows placement of a GPS location given a starting location.
 * Defaults to the application default zoom level.
 */
const Gps = ({ center, zoom = 12 }) => {
  const mapId = useId()
  useEffect(() => {
    L.Browser.touch = false
    const mapOptions = {
      center,
      zoom,
      bounceAtZoomLimits: true,
      zoomControl: false,
      attributionControl: false,
      controls: {
        layers: {
          visible: true,
          position: 'bottomright',
          collapsed: true,
        },
      },
      doubleClickZoom: true,
      boxZoom: false,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 350,
      scrollWheelZoom: 'center',
    }
    debug('creating map')
    const map = L.map(mapId, mapOptions)

    const zoomControl = L.control.zoom({ position: 'bottomright' })

    const scaleOptions = {
      position: 'bottomright',
    }
    const scale = L.control.scale(scaleOptions)

    const baseLayers = {
      OpenStreetMap: L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxNativeZoom: maxNativeZoom,
          maxZoom: maxZoom,
        }
      ),
    }
    baseLayers['OpenStreetMap'].addTo(map)

    const overlays = {}
    const layerConfig = {
      position: 'bottomright',
      collapsed: true,
      hideSingleBase: false,
    }

    const layerControl = L.control.layers(baseLayers, overlays, layerConfig)

    scale.addTo(map)
    zoomControl.addTo(map)
    layerControl.addTo(map)

    // make a marker stay at the centre
    const stickyCenterMarker = L.marker(center).addTo(map)
    map.on('move', ({ target }) => {
      const center = target.getCenter()
      stickyCenterMarker.setLatLng(center)
      debug('move', center)
    })

    return () => {
      debug('removing map')
      map.remove()
    }
  }, [center, zoom])

  const mapStyle = {
    flex: 1,
    margin: 0,
    height: '100%',
    minHeight: '250px',
    background: 'black',
  }

  // TODO maybe clone all children and add zIndex to their styles
  return <div id={mapId} style={mapStyle}></div>
}
Gps.propTypes = {
  center: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,
}
export default Gps
