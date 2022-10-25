import React, { useEffect, useId } from 'react'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'

const debug = Debug('webdos:components:Map')
// TODO instantiate map using an html element, so no IDs are used
const maxNativeZoom = 18
const maxZoom = 22
const Map = () => {
  const mapId = useId()
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
          position: 'bottomright',
          collapsed: true,
        },
      },
      doubleClickZoom: true,
      boxZoom: false,
      zoomDelta: 1,
      wheelPxPerZoomLevel: 350,
    }
    debug('creating map')
    const map = L.map(mapId, mapOptions)
    const geometryLayer = L.featureGroup().addTo(map)

    const zoomControl = L.control.zoom({ position: 'bottomright' })

    const scaleOptions = {
      position: 'bottomright',
    }
    const scale = L.control.scale(scaleOptions)

    const drawOptions = {
      position: 'bottomright',
      draw: {
        polyline: false,
        polygon: {
          metric: true,
          showArea: true,
          allowIntersection: false,
          drawError: {
            color: '#b00b00',
            message: 'impossible shape',
            timeout: 1000,
          },
          shapeOptions: {
            color: '#662d91',
          },
        },
        circle: false,
        marker: false,
      },
      edit: {
        featureGroup: geometryLayer,
        edit: {},
        remove: false,
      },
    }
    const drawControl = new L.Control.Draw(drawOptions)

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

    map.on('draw:edited', (e) => {
      // all layers come back, but we can tag them
      debug('draw:edited')
      const layers = e.layers
      let modifiedGeometry = {}
      layers.eachLayer(function (layer) {
        modifiedGeometry[layer.sectorId] = layer.toGeoJSON()
      })
      // geometryEdited(modifiedGeometry)
    })

    map.on('draw:created', (event) => {
      debug('draw:created')
      const geoJson = event.layer.toGeoJSON()
      // geometryCreated(geoJson)
    })

    scale.addTo(map)
    zoomControl.addTo(map)
    drawControl.addTo(map)
    layerControl.addTo(map)
    return () => {
      debug('removing map')
      map.remove()
    }
  }, [])

  const paintBelowAllOthers = -1
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

  // TODO maybe clone all children and add zIndex to their styles
  return <div id={mapId} style={mapBackgroundStyle}></div>
}
Map.propTypes = {}
export default Map
