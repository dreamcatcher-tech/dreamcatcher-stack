import { useEffect, useState } from 'react'
import L from '../leaflet'
import Debug from 'debug'

const debug = Debug('webdos:components:useMap')
const maxNativeZoom = 18
const maxZoom = 22

export const useMap = (mapId) => {
  const [map, setMap] = useState()
  useEffect(() => {
    // L.Browser.touch = false
    const mapOptions = {
      center: [-37.76976, 175.27605],
      zoom: 12,
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
      pmIgnore: false,
      preferCanvas: false,
    }
    debug('creating map')
    const _map = L.map(mapId, mapOptions)
    const zoomControl = L.control.zoom({ position: 'bottomright' })

    const scaleOptions = { position: 'bottomright' }
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
      position: 'bottomright',
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
      // consumers of the map need to know if it is stale
      _map.isRemoved = true
      _map.remove()
    }
  }, [])
  return map
}
