import React from 'react'
import Debug from 'debug'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from '@monsonjeremy/react-leaflet'
import 'leaflet/dist/leaflet.css'
import { AutoSizer, List } from 'react-virtualized'
import 'react-virtualized/styles.css' // only needs to be imported once

const debug = Debug('terminal:widgets:Mapping')

const Mapping = ({ blocks, path, cwd }) => {
  return (
    <MapContainer
      class="flex-map"
      center={[-37.768142, 175.270409]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ flex: 1 }}
      bounceAtZoomLimits
      zoomControl={false}
      attributionControl={false}
      controls={{
        layers: {
          visible: true,
          position: 'bottomright',
          collapsed: true,
        },
      }}
      doubleClickZoom
      boxZoom={false}
      zoomDelta={1}
      wheelPxPerZoomLevel={350}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[51.505, -0.09]}>
        <Popup>popup</Popup>
      </Marker>
    </MapContainer>
  )
}

export default Mapping
