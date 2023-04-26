import React, { useEffect, useId } from 'react'
import PropTypes from 'prop-types'
import L from './leaflet'
import Debug from 'debug'
import { useMap } from './Map/useMap'
import '@geoapify/leaflet-address-search-plugin'
import '@geoapify/leaflet-address-search-plugin/dist/L.Control.GeoapifyAddressSearch.min.css'
import './Map/address.css'

import CardHeader from '@mui/material/CardHeader'
import Card from '@mui/material/Card'

const API_KEY = '10a96996c19e4b2184fcb5b482149a33'
const debug = Debug('webdos:components:Gps')
const maxNativeZoom = 18
const maxZoom = 22
const ham = [-37.76976, 175.27605]
/**
 * Show the original geocoded address location, and show the adjusted location
 * that the user moved it to.
 *
 * Whenever the customer is viewed, check if the gps is still accurate.
 *
 * When not found, what to do ?
 *
 * Manual tick box for manual adjustment or not.
 * Manual adjustment allows writing in the address field directly.
 *
 * System checkbox for geocode match or not
 * Manual checkbox for manual placement.  No geocode match but manual placement
 * is a passable customer.
 * System geocode with manual checkbox will show two markers - one for the
 * geocoded location and one for the manual location.
 *
 * Leaftlet geocoder then on selection it updates the service address field.
 * Help hint in the field telling using to use the map.
 * service address is readonly unless the manual checkbox is ticked.
 * With manual, the marker must be placed directly.
 * Without manual, the gps location is set only when the address is geocoded.
 * Manual adjustment + geocoding is the same as manual adjustment only ?
 *
 */

const Gps = ({ center = ham, zoom = 12, edit, ...props }) => {
  const mapId = useId()
  const map = useMap(mapId)
  useEffect(() => {
    if (!map || map.isRemoved) {
      return
    }
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
      map.removeLayer(stickyCenterMarker)
    }
  }, [map, center, zoom])

  useEffect(() => {
    if (!edit || !map || map.isRemoved) {
      return
    }
    debug('map', map)
    const addressSearchControl = L.control.addressSearch(API_KEY, {
      position: 'topleft',
      className: 'custom-address-field',
      mapViewBias: true,

      resultCallback: (address) => {
        console.log(address)
      },
      suggestionsCallback: (suggestions) => {
        console.log(suggestions)
      },
    })
    map.addControl(addressSearchControl)
    return () => {
      map.removeControl(addressSearchControl)
    }
  }, [map, edit])

  useEffect(() => {
    if (!map || map.isRemoved) {
      return
    }
    if (!edit) {
      // TODO make the centre of the map fixed always
      // map.scrollWheelZoom.disable()
      map.dragging.disable()
      // map.touchZoom.disable()
      map.doubleClickZoom.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      if (map.tap) {
        map.tap.disable()
      }
    } else {
      // map.scrollWheelZoom.enable()
      map.dragging.enable()
      // map.touchZoom.enable()
      map.doubleClickZoom.enable()
      map.boxZoom.enable()
      map.keyboard.enable()
      if (map.tap) {
        map.tap.enable()
      }
    }
  }, [map, edit])

  const mapStyle = {
    flex: 1,
    margin: 0,
    height: '100%',
    minHeight: '250px',
    width: '100%',
    minWidth: '250px',
    background: 'black',
  }

  return (
    <Card {...props} style={mapStyle}>
      <div id={mapId} style={{ height: '100%' }}></div>
    </Card>
  )
}
Gps.propTypes = {
  center: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,
  edit: PropTypes.bool,
}
export default Gps
