import React, { useEffect, useId, useState } from 'react'
import { Grid, Stack, Box } from '@mui/material'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'

const debug = Debug('webdos:components:Map')
const maxNativeZoom = 18
const maxZoom = 22
const Map = ({ children, onCreate, onEdit, geoJson }) => {
  const mapId = useId()
  const [mapState, setMap] = useState()
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
    }
    debug('creating map')
    const map = L.map(mapId, mapOptions)
    setMap(map)
    const zoomControl = L.control.zoom({ position: 'topright' })

    const scaleOptions = { position: 'topright' }
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

    map.on('pm:edit', (event) => {
      // all layers come back, but we can tag them
      debug('draw:edited', event)
      const layers = event.layers
      let modifiedGeometry = {}
      layers.eachLayer(function (layer) {
        modifiedGeometry[layer.sectorId] = layer.toGeoJSON()
      })
      onEdit(modifiedGeometry)
    })

    map.on('pm:create', (event) => {
      debug('draw:created', event)
      const geoJson = event.layer.toGeoJSON()
      event.layer.remove()
      console.log(event)
      onCreate(geoJson)
    })

    scale.addTo(map)
    layerControl.addTo(map)
    zoomControl.addTo(map)

    if (onCreate) {
      map.pm.addControls({
        position: 'topright',
        drawCircle: false,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawText: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: false,
        rotateMode: false,
        editControls: false,
      })
    }
    return () => {
      debug('removing map')
      map.remove()
      setMap(undefined)
    }
  }, [])

  useEffect(() => {
    if (!mapState) {
      return
    }
    debug('geoJson', geoJson)
    const geometryLayer = L.featureGroup().addTo(mapState)

    for (const geo of geoJson) {
      const opacity = 0.65
      const fillOpacity = 0.3
      const layerStyle = {
        color: 'red',
        weight: 3,
        opacity: opacity,
        fillOpacity: fillOpacity,
        clickable: true,
      }
      const layer = L.geoJson(geo, {
        style: layerStyle,
      })
      geometryLayer.addLayer(layer)
      layer.on('click', (e) => {
        console.log('click', e)
      })
    }

    return () => {
      debug(`removing geometryLayer`)
      geometryLayer.remove()
    }
  }, [mapState, geoJson])

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

  return (
    <>
      <div id={mapId} style={mapBackgroundStyle}></div>
      <Box
        sx={{
          zIndex: 1000,
          position: 'relative',
          // width: 'min-content',
          // height: '100%',
          // flex: 1,
        }}
      >
        {children}
      </Box>
    </>
  )
}
Map.propTypes = {
  children: PropTypes.node,
  onCreate: PropTypes.func,
  onEdit: PropTypes.func,
  geoJson: PropTypes.array,
}
Map.defaultProps = {
  geoJson: [],
}
export default Map
