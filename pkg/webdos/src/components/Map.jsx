import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { api } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'
import assert from 'assert-fast'
import { useResizeDetector } from 'react-resize-detector'

const debug = Debug('webdos:components:Map')
const maxNativeZoom = 18
const maxZoom = 22
const Map = ({ onCreate, onEdit, markers, onSector, onMarker, complex }) => {
  const mapId = useId()
  const mapRef = useRef()
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
      // preferCanvas: true,
    }
    debug('creating map')
    const map = L.map(mapId, mapOptions)

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
    debug('map created')
    mapRef.current = map
    return () => {
      debug('removing map')
      map.remove()
      mapRef.current = undefined
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !complex) {
      return
    }
    debug('adding sectors', complex)
    const geometryLayer = L.featureGroup().addTo(map)
    for (const { state, path } of complex.network) {
      const { formData: sector } = state
      const opacity = 0.65
      const fillOpacity = 0.3
      const { color, geometry } = sector
      const layerStyle = {
        color,
        weight: 3,
        opacity: opacity,
        fillOpacity: fillOpacity,
        clickable: true,
      }
      const layer = L.geoJson(geometry, {
        style: layerStyle,
      })
      layer.on('click', () => {
        if (onSector) {
          onSector(path)
        }
      })
      layer.bindTooltip(sector.name, { sticky: true })
      geometryLayer.addLayer(layer)
    }
    debug('sectors added')
    return () => {
      debug(`removing sectors`)
      geometryLayer.remove()
    }
  }, [mapRef.current, complex])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !complex || !markers) {
      return // TODO detect deep equals of complex
    }
    debug('adding customers')
    const customersLayer = L.featureGroup().addTo(map)
    const customers = complex.tree.child('customers')
    for (const { state } of complex.network) {
      const { formData: sector } = state
      const { order = [] } = sector
      for (const [index, custNo] of order.entries()) {
        assert(customers.hasChild(custNo), `customer ${custNo} not found`)
        const customer = customers.child(custNo)
        const { serviceGps } = customer.state.formData
        const { latitude, longitude } = serviceGps
        const options = { riseOnHover: true }
        const marker = L.marker([latitude, longitude], options)
        marker.setIcon(createIcon(sector.color, index + 1))
        if (onMarker) {
          marker.on('click', () => onMarker(custNo))
        }
        marker.addTo(customersLayer)
      }
    }
    debug('customers added')
    return () => {
      debug(`removing customers`)
      customersLayer.remove()
    }
  }, [mapRef.current, complex, markers])

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
  const onResize = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize()
    }
  }, [mapRef.current])

  const { ref } = useResizeDetector({
    onResize,
  })

  return <div ref={ref} id={mapId} style={mapBackgroundStyle}></div>
}
const createIcon = (color, number) => {
  const options = {
    isAlphaNumericIcon: true,
    text: number,
    iconShape: 'marker',
    borderColor: color,
    color,
    textColor: '#00ABDC',
  }
  return L.BeautifyIcon.icon(options)
}
Map.propTypes = {
  onCreate: PropTypes.func,
  onEdit: PropTypes.func,
  onSector: PropTypes.func,
  onCustomer: PropTypes.func,
  markers: PropTypes.bool,
  complex: PropTypes.instanceOf(api.Complex),
  hidden: PropTypes.bool,
}
export default Map
