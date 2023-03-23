import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'
import assert from 'assert-fast'
import { useResizeDetector } from 'react-resize-detector'
import delay from 'delay'

const debug = Debug('webdos:components:Map')
const maxNativeZoom = 18
const maxZoom = 22
export default function MapComponent({
  onCreate,
  onEdit,
  crisp,
  onSector,
  sector,
  onMarker,
  marker,
  markers,
  reorder,
}) {
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
      preferCanvas: true,
    }
    debug('creating map')
    const map = L.map(mapId, mapOptions)

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
    baseLayers.HEREMaps.addTo(map)

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
    map.on('zoomend', (event) => {
      debug('zoomend', map.getZoom())
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
    if (!map || !crisp || crisp.isLoading) {
      return
    }
    debug('adding sectors', crisp)
    const geometryLayer = L.featureGroup().addTo(map)
    for (const path of crisp) {
      debug('adding sector', path)
      const child = crisp.getChild(path)
      if (child.isLoading) {
        continue
      }
      const { formData: sector } = child.state
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
  }, [mapRef.current, crisp])
  // TODO split out the drawing from the data generation portions
  useEffect(() => {
    let isActive = true
    const map = mapRef.current
    if (!map || !crisp || !markers || !sector) {
      debug('no map or complex or markers')
      return
    }
    if (!crisp.parent || !crisp.parent.hasChild('customers')) {
      debug('no customers')
      return
    }
    debug('adding markers', sector, markers)
    let layer
    const chunkLoad = async () => {
      debug('adding customers to sector id:', sector)
      const customers = crisp.parent.getChild('customers')
      if (customers.isLoading) {
        return
      }
      const { state } = crisp.getChild(sector)
      const { formData } = state
      const { order = [] } = formData
      debug('order', order)
      const markersArray = []
      debug('adding markers', order.length)
      let count = 0
      for (const [index, custNo] of order.entries()) {
        assert(customers.hasChild(custNo), `customer ${custNo} not found`)
        const customer = customers.getChild(custNo)
        const { serviceGps } = customer.state.formData
        const { latitude, longitude } = serviceGps
        const options = { riseOnHover: true }
        const marker = L.marker([latitude, longitude], options)
        marker.data = {
          color: formData.color,
          id: custNo,
          index,
        }
        setIcon(marker)
        if (onMarker) {
          marker.on('click', () => onMarker(custNo))
        }
        markersArray.push(marker)
        count++
        if (count % 100 === 0) {
          await delay()
          if (!isActive) {
            return
          }
        }
      }
      debug('markers generated', markersArray.length)
      const tooManyMarkers = 300
      if (markersArray.length < tooManyMarkers) {
        layer = L.featureGroup().addTo(map)
        markersArray.forEach((marker) => layer.addLayer(marker))
      } else {
        layer = L.markerClusterGroup({
          zoomToBoundsOnClick: false,
          disableClusteringAtZoom: 16,
        }).addTo(map)
        layer.addLayers(markersArray, {
          chunkedLoading: true,
          chunkInterval: 50,
        })
      }
      debug('markers added')
      setMarkersArray(markersArray)
    }
    chunkLoad()
    return () => {
      isActive = false
      debug(`removing customers`)
      if (layer) {
        layer.remove()
      }
      setMarkersArray([])
    }
  }, [mapRef.current, crisp, markers, sector])
  const [markersArray, setMarkersArray] = useState([])
  useEffect(() => {
    // sweep thru markers and update the data icon
    const map = new Map()
    if (reorder && reorder.length === markersArray.length) {
      reorder.forEach((id, index) => map.set(id, index))
    }
    for (const [index, marker] of markersArray.entries()) {
      let orderIndex = map.get(marker.data.id)
      orderIndex = orderIndex === undefined ? index : orderIndex
      if (marker.data.index !== orderIndex) {
        marker.data.index = orderIndex
        setIcon(marker)
      }
    }
  }, [markersArray, reorder])
  useEffect(() => {
    debug('selected marker', marker)
    const selectedMarker = markersArray.find(({ data }) => data.id === marker)
    if (!selectedMarker) {
      return
    }
    selectedMarker.data.isSelected = true
    setIcon(selectedMarker)
    return () => {
      selectedMarker.data.isSelected = false
      setIcon(selectedMarker)
    }
  }, [markersArray, marker])

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

  const { ref } = useResizeDetector({ onResize })

  return <div ref={ref} id={mapId} style={mapBackgroundStyle}></div>
}
const setIcon = (marker) => {
  const { color, index, isSelected } = marker.data
  const number = index + 1
  const options = {
    isAlphaNumericIcon: true,
    text: number,
    iconShape: 'marker',
    borderColor: color,
    color,
    textColor: '#00ABDC',
  }
  marker.setZIndexOffset(0)
  if (isSelected) {
    options.backgroundColor = 'lightgreen'
    marker.setZIndexOffset(1000)
  }
  const icon = L.BeautifyIcon.icon(options)
  marker.setIcon(icon)
}
MapComponent.propTypes = {
  onCreate: PropTypes.func,
  onEdit: PropTypes.func,
  /**
   * Crisp representing the sectors to be displayed on the map
   */
  crisp: PropTypes.instanceOf(Crisp),
  onSector: PropTypes.func,
  /**
   * The selected sector
   */
  sector: PropTypes.string,
  onMarker: PropTypes.func,
  /**
   * The id of the selected marker
   */
  marker: PropTypes.string,
  /**
   * Should markers be displayed on the map?
   */
  markers: PropTypes.bool, // TODO replace with implicit signal
  /**
   * The mutated order of the markers for the current sector.
   * Used to show live updates during sorting.
   */
  reorder: PropTypes.arrayOf(PropTypes.string),
}
