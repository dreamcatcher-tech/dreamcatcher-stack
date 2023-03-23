import equals from 'fast-deep-equal'
import { useEffect, useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import L from '../leaflet'
import Debug from 'debug'
const debug = Debug('webdos:components:Map:Sectors')

export const Sectors = ({ map, routing, edit }) => {
  const [sectors, setSectors] = useState([])

  useEffect(() => {
    if (!routing || routing.isLoadingChildren) {
      return update(setSectors, [])
    }
    const sectors = routing.sortedChildren.map((path) => {
      const child = routing.getChild(path)
      const { formData: sector = {} } = child.state
      const { name, color, geometry } = sector
      return { path, name, color, geometry }
    })
    return update(setSectors, sectors)
  }, [routing])

  useEffect(() => {
    if (!map || map.isRemoved || !sectors.length) {
      return
    }
    debug('adding sectors', sectors)
    const geometryLayer = L.featureGroup()
    map.addLayer(geometryLayer)
    for (const { path, name, color, geometry } of sectors) {
      if (!name || !color || !geometry) {
        continue
      }
      const opacity = 0.65
      const fillOpacity = 0.3
      const layerStyle = {
        color,
        weight: 3,
        opacity: opacity,
        fillOpacity: fillOpacity,
        clickable: true,
      }
      const layer = L.geoJson(geometry, { style: layerStyle })
      layer.on('click', () => {
        // TODO cd with memory based on what the last path was
        routing.actions.cd(routing.absolutePath + '/' + path)
      })
      layer.bindTooltip(name, { sticky: true })
      geometryLayer.addLayer(layer)
    }
    debug('sectors added')
    return () => {
      debug(`removing sectors`, sectors)
      geometryLayer.remove()
    }
  }, [map, sectors])

  useEffect(() => {
    if (!map || map.isRemoved) {
      return
    }
    map.on('pm:edit', (event) => {
      // all layers come back, but we can tag them
      debug('draw:edited', event)
      const layers = event.layers
      let modifiedGeometry = {}
      layers.eachLayer(function (layer) {
        modifiedGeometry[layer.sectorId] = layer.toGeoJSON()
      })
      // TODO use crisp actions to edit the router datum
    })

    map.on('pm:create', (event) => {
      debug('draw:created', event)
      const geoJson = event.layer.toGeoJSON()
      event.layer.remove()
      console.log(event)
      routing.actions.add(geoJson)
    })
    if (edit) {
      map.pm.addControls(editControls)
    }
  }, [map])
}
Sectors.propTypes = {
  edit: PropTypes.bool,
  map: PropTypes.object,
  routing: PropTypes.instanceOf(Crisp),
}
const editControls = {
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
}
const update = (setState, state) => {
  setState((current) => {
    if (equals(current, state)) {
      return current
    }
    return state
  })
}
