import { eventLoopSpinner } from 'event-loop-spinner'
import equals from 'fast-deep-equal'
import { useEffect, useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import L from '../leaflet'
import Debug from 'debug'
import assert from 'assert-fast'

const debug = Debug('webdos:components:Map:Markers')

export const Markers = ({ map, customers, sector, reorder }) => {
  const [markersArray, setMarkersArray] = useState([])
  const [iconsArray, setIconsArray] = useState([])
  const { formData: sectorState } = sector?.state || {}

  useEffect(() => {
    if (!customers || customers.isLoadingChildren || !sectorState) {
      return
    }
    const { order = [], color } = sectorState
    debug('order', order)
    debug('adding markers', order.length)
    const markersArray = order.map((custNo, index) => {
      assert(customers.hasChild(custNo), `customer ${custNo} not found`)
      const customer = customers.getChild(custNo)
      const { serviceGps } = customer.state.formData
      const { latitude, longitude } = serviceGps
      if (eventLoopSpinner.isStarving()) {
        debug('starving')
      }
      return { latitude, longitude, color, id: custNo, index }
    })
    debug('markers generated', markersArray.length)
    return update(setMarkersArray, markersArray)
  }, [customers, sectorState])

  useEffect(() => {
    if (!map || map.isRemoved || !sector) {
      debug('no map or selected sector')
      return
    }
    const icons = markersArray.map((markerData) => {
      const { latitude, longitude, color, id, index } = markerData
      const options = { riseOnHover: true }
      const marker = L.marker([latitude, longitude], options)
      marker.data = { color, id, index }
      setIcon(marker)
      marker.on('click', () => {
        debug('marker click', id)
        const allowVirtual = true
        sector.actions.cd(sector.absolutePath + '/' + id, allowVirtual)
      })
      if (eventLoopSpinner.isStarving()) {
        debug('starving')
      }
      return marker
    })
    setIconsArray(icons)
    debug('markers generated', icons.length)

    const tooManyMarkers = 300
    let layer
    if (icons.length < tooManyMarkers) {
      layer = L.featureGroup().addTo(map)
      icons.forEach((marker) => layer.addLayer(marker))
    } else {
      layer = L.markerClusterGroup({
        zoomToBoundsOnClick: false,
        disableClusteringAtZoom: 16,
      }).addTo(map)
      layer.addLayers(icons, {
        chunkedLoading: true,
        chunkInterval: 50,
      })
    }
    debug('markers added')
    return () => {
      debug(`removing customers`)
      layer.remove()
    }
  }, [map, markersArray])

  useEffect(() => {
    // sweep thru markers and update the data icon
    const map = new Map()
    if (reorder?.length) {
      reorder.forEach((id, index) => map.set(id, index))
    }
    for (const [index, marker] of iconsArray.entries()) {
      let orderIndex = map.get(marker.data.id)
      orderIndex = orderIndex === undefined ? index : orderIndex
      if (marker.data.index !== orderIndex) {
        marker.data.index = orderIndex
        setIcon(marker)
      }
    }
  }, [iconsArray, reorder])

  const marker = sector?.getSelectedChild()
  useEffect(() => {
    debug('selected marker', marker)
    const selectedMarker = iconsArray.find(({ data }) => data.id === marker)
    if (!selectedMarker) {
      debug('selected marker not found', marker)
      return
    }
    selectedMarker.data.isSelected = true
    setIcon(selectedMarker)
    return () => {
      selectedMarker.data.isSelected = false
      setIcon(selectedMarker)
      debug('selected marker removed', marker)
    }
  }, [iconsArray, marker])
}

Markers.propTypes = {
  map: PropTypes.object,
  customers: PropTypes.instanceOf(Crisp),
  sector: PropTypes.instanceOf(Crisp),
  reorder: PropTypes.arrayOf(PropTypes.string),
}

const update = (setState, state) => {
  setState((current) => {
    if (equals(current, state)) {
      return current
    }
    return state
  })
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
