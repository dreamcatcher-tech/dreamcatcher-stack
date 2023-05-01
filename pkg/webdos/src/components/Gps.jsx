import { useResizeDetector } from 'react-resize-detector'
import PropTypes from 'prop-types'
import equals from 'fast-deep-equal'
import { Crisp } from '@dreamcatcher-tech/interblock'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import React, { useState, useEffect, useCallback } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeader from '@mui/material/CardHeader'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Actions } from '.'
import assert from 'assert-fast'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv8'
import L from './leaflet'
import Debug from 'debug'
import { useMap } from './Map/useMap'
import '@geoapify/leaflet-address-search-plugin'
import '@geoapify/leaflet-address-search-plugin/dist/L.Control.GeoapifyAddressSearch.min.css'
import './Map/address.css'
import { CardContent } from '@mui/material'

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

const Gps = ({
  crisp,
  onEdit,
  center = ham,
  zoom = 12,
  editing = false,
  ...props
}) => {
  const [mapId, map] = useMap()
  const onResize = useCallback(() => {
    map && map.invalidateSize()
    debug('onResize')
  }, [map])
  const { ref } = useResizeDetector({ onResize })
  const [isEditing, setIsEditing] = useState(editing)
  const [expanded, setExpanded] = useState(true)
  const theme = createTheme()
  const noDisabled = createTheme({ palette: { text: { disabled: '0 0 0' } } })

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

  const onAddress = (name, latitude, longitude) => {
    debug('onAddress', name, latitude, longitude)
    if (formData.serviceAddress !== name) {
      const gps = { latitude, longitude }
      setFormData({ ...formData, serviceAddress: name, gps })
    }
  }

  useEffect(() => {
    if (!isEditing || !map || map.isRemoved) {
      return
    }
    debug('map', map)
    const addressSearchControl = L.control.addressSearch(API_KEY, {
      position: 'topleft',
      className: 'custom-address-field',
      mapViewBias: true,
      resultCallback: (address) => {
        debug('resultCallback', address)
        // move the map to this location
        // use the callback to update the datum
        const { name, lat, lon } = extract(address)
        onAddress && onAddress(name, lat, lon)
      },
      suggestionsCallback: (suggestions) => {
        debug('suggestionsCallback', suggestions)
      },
    })
    map.addControl(addressSearchControl)
    return () => {
      map.removeControl(addressSearchControl)
    }
  }, [map, isEditing])

  useEffect(() => {
    if (!map || map.isRemoved) {
      return
    }
    if (!isEditing) {
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
  }, [map, isEditing])

  const mapStyle = {
    flex: 1,
    margin: 0,
    height: '100%',
    minHeight: '250px',
    width: '100%',
    minWidth: '250px',
    background: 'black',
  }

  const onExpand = (e, isExpanded) => {
    if (isEditing) {
      if (isDirty) {
        return
      }
      onCancel(e)
    }
    setExpanded(isExpanded)
  }

  const schema = {
    type: 'object',
    required: [],
    properties: {
      isManualGps: {
        title: 'Manual GPS',
        type: 'boolean',
        default: false,
      },
      serviceAddress: {
        title: 'Service Address',
        type: 'string',
        faker: 'address.streetAddress',
      },
    },
  }
  const uiSchema = {
    'ui:submitButtonOptions': { norender: true },
  }
  const { isManualGps } = crisp.state.formData || {}
  if (!isManualGps) {
    uiSchema.serviceAddress = { 'ui:readonly': true }
  }
  let form
  return (
    <Card>
      <Accordion expanded={expanded} onChange={onExpand}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon fontSize="large" />}
          sx={{ display: 'flex' }}
        >
          <CardHeader title="Service Address" sx={{ p: 0, flexGrow: 1 }} />
          {/* {isEditing ? Editing : viewOnly ? null : Viewing} */}
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
          <ThemeProvider theme={isEditing ? theme : noDisabled}>
            <Form
              validator={validator}
              // disabled={isPending || !isEditing || viewOnly}
              schema={schema}
              uiSchema={uiSchema}
              // formData={formData}
              // onChange={onChange}
              // onSubmit={onSubmit}
              ref={(_form) => (form = _form)}
            />
          </ThemeProvider>
          <Card style={mapStyle} ref={ref} id={mapId} />
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
Gps.propTypes = {
  center: PropTypes.arrayOf(PropTypes.number),
  zoom: PropTypes.number,

  /**
   * The customer for which address management is being done.
   */
  crisp: PropTypes.instanceOf(Crisp),

  /**
   * Callback when the edit status changes
   */
  onEdit: PropTypes.func,

  /**
   * Testing: start the component in edit mode
   */
  editing: PropTypes.bool,
}
export default Gps

const extract = (address) => {
  const { address_line1, city, lat, lon } = address
  assert.strictEqual(typeof address_line1, 'string')
  assert.strictEqual(typeof city, 'string')
  assert.strictEqual(typeof lat, 'number')
  assert.strictEqual(typeof lon, 'number')
  const name = `${address_line1}, ${city}`
  return { name, lat, lon }
}
