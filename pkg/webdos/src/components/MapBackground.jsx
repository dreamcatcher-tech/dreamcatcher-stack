import React, { useState, useEffect } from 'react'
import Debug from 'debug'
import './shim'
import 'leaflet/dist/leaflet.css'
import * as L from 'leaflet'

import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw/dist/leaflet.draw.js'

import 'leaflet-providers'

import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

import 'leaflet-extra-markers/dist/css/leaflet.extra-markers.min.css'
import 'leaflet-extra-markers/dist/js/leaflet.extra-markers.min'

const debug = Debug('terminal:widgets:Mapping')

// TODO instantiate map using an html element, so no IDs are used
const MAP_ID = 'mapId'
const maxNativeZoom = 18
const maxZoom = 22
const isMapOn = true
const MapBackground = ({ children }) => {
  useEffect(() => {
    if (!isMapOn) {
      return
    }
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
    const map = L.map(MAP_ID, mapOptions)
    const geometryLayer = L.featureGroup().addTo(map)

    // TODO try operate without globals
    if (!window.hamr) {
      window.hamr = {}
    }
    window.hamr.map = map
    window.hamr.geometryLayer = geometryLayer

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

    map.on(L.Draw.Event.CREATED, (event) => {
      debug('draw:created')
      const geoJson = event.layer.toGeoJSON()
      // geometryCreated(geoJson)
    })

    scale.addTo(map)
    zoomControl.addTo(map)
    drawControl.addTo(map)
    layerControl.addTo(map)

    return () => {
      map.remove()
    }
  }, [])

  const containerAsPositionedElement = 'relative'
  const mapContainerStyle = {
    flex: 1,
    position: containerAsPositionedElement,
  }

  const mustHaveZIndex = 0
  const ensureNotPartOfNormalLayout = 'absolute'
  const mapBackgroundStyle = {
    left: '0px',
    right: '0px',
    top: '0px',
    bottom: '0px',
    position: ensureNotPartOfNormalLayout,
    margin: 0,
    background: 'black',
    zIndex: mustHaveZIndex,
  }

  // TODO maybe clone all children and add zIndex to their styles
  return (
    <div id="mapContainer" style={mapContainerStyle}>
      <div id={MAP_ID} style={mapBackgroundStyle}></div>
      {children}
    </div>
  )
}

export default MapBackground
