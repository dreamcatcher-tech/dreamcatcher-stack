import React, { useEffect, useId } from 'react'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'
const debug = Debug('webdos:components:Gps')
const maxNativeZoom = 18
const maxZoom = 22
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
          position: 'topright',
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

    const zoomControl = L.control.zoom({ position: 'topright' })

    const scaleOptions = {
      position: 'topright',
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
      position: 'topright',
      collapsed: true,
      hideSingleBase: false,
    }

    const layerControl = L.control.layers(baseLayers, overlays, layerConfig)

    scale.addTo(map)
    zoomControl.addTo(map)
    layerControl.addTo(map)

    const options = {
      iconShape: 'marker',
      borderColor: 'blue',
      color: 'blue',
      textColor: '#00ABDC',
    }
    const icon = L.BeautifyIcon.icon(options)
    const stickyCenterMarker = L.marker(center, { icon }).addTo(map)
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

  return <div id={mapId} style={mapStyle}></div>
}
Gps.propTypes = {
  center: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,
}
export default Gps
