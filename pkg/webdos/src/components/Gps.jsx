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
const mapStyle = {
  flex: 1,
  margin: 0,
  height: '100%',
  minHeight: '250px',
  width: '100%',
  minWidth: '250px',
  background: 'black',
}
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

/**
 * The tick boxes.
 *
 * The only way Geocoded can become ticked is by the system setting that flag.
 * Acts like isEmailVerified.
 * If select Manual, then if geocoded address is changed, or GPS coordinates
 * are altered, then the Geocoded flag is unticked.
 *
 */

const Gps = ({ crisp, onEdit, viewOnly, editing = false }) => {
  assert(crisp.state.formData)
  const [formData, setFormData] = useState(crisp.state.formData)
  const [isPending, setIsPending] = useState(false)
  const [isEditing, setIsEditingState] = useState(editing)
  const [expanded, setExpanded] = useState(true)
  const [startingState, setStartingState] = useState(crisp.state)

  const setIsEditing = (isEditing) => {
    setIsEditingState(isEditing)
    onEdit && onEdit(isEditing)
  }

  if (!equals(startingState, crisp.state)) {
    debug('state changed', startingState, crisp.state)
    setStartingState(crisp.state)
    setFormData(crisp.state.formData)
    // TODO alert if changes not saved
  }
  const isDirty = !equals(formData, startingState.formData)
  debug('isDirty', isDirty)
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setFormData(formData)
  }
  const onSubmit = () => {
    debug('onSubmit', formData)
    setIsPending(true)
    crisp.ownActions.set({ formData }).then(() => {
      setIsPending(false)
      setIsEditing(false)
    })
  }
  const onSave = (e) => {
    debug('onSave', e)
    e.stopPropagation()
    form.submit()
  }
  const onCancel = (e) => {
    debug('onCancel', e)
    e.stopPropagation()
    setIsEditing(false)
    setFormData(crisp.state.formData)
  }
  const Editing = (
    <>
      <IconButton onClick={isPending ? null : onSave}>
        <Save color={isPending ? 'disabled' : 'primary'} />
      </IconButton>
      <IconButton onClick={isPending ? null : onCancel}>
        <Cancel color={isPending ? 'disabled' : 'secondary'} />
      </IconButton>
    </>
  )
  const onStartEdit = (e) => {
    debug('onEdit', e)
    setExpanded(true)
    e.stopPropagation()
    setIsEditing(true)
  }
  const Viewing = (
    <IconButton onClick={onStartEdit}>
      <Edit color="primary" />
    </IconButton>
  )
  const onExpand = (e, isExpanded) => {
    if (isEditing) {
      if (isDirty) {
        return
      }
      onCancel(e)
    }
    setExpanded(isExpanded)
  }

  const theme = createTheme()
  const noDisabled = createTheme({ palette: { text: { disabled: '0 0 0' } } })

  const onAddress = (name, latitude, longitude) => {
    debug('onAddress', name, latitude, longitude)
    if (formData.serviceAddress !== name) {
      const gps = { latitude, longitude }
      setFormData({ ...formData, serviceAddress: name, gps })
    }
  }
  const isGeocoding = isEditing && formData.isGeocodedGps
  const [mapId, ref] = useGpsMap({ isGeocoding, onAddress })

  const schema = {
    type: 'object',
    required: [],
    properties: {
      isGeocodedGps: {
        title: 'Geocoded GPS',
        type: 'boolean',
        default: true,
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
  const { isGeocodedGps } = crisp.state.formData || {}
  if (isGeocodedGps) {
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
          {isEditing ? Editing : viewOnly ? null : Viewing}
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
          <ThemeProvider theme={isEditing ? theme : noDisabled}>
            <Form
              validator={validator}
              disabled={isPending || !isEditing || viewOnly}
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              onChange={onChange}
              onSubmit={onSubmit}
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
  /**
   * The customer for which address management is being done.
   */
  crisp: PropTypes.instanceOf(Crisp),

  /**
   * Callback when the edit status changes
   */
  onEdit: PropTypes.func,

  /**
   * View only mode, with no editing buttons displayed
   */
  viewOnly: PropTypes.bool,

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

const useGpsMap = ({ isGeocoding, onAddress }) => {
  const center = ham
  const zoom = 12
  const [mapId, map] = useMap()
  const onResize = useCallback(() => {
    map && !map.isRemoved && map.invalidateSize()
    debug('onResize')
  }, [map])
  const { ref } = useResizeDetector({ onResize })

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
    if (!isGeocoding || !map || map.isRemoved) {
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
  }, [map, isGeocoding])

  useEffect(() => {
    if (!map || map.isRemoved) {
      return
    }
    if (!isGeocoding) {
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
  }, [map, isGeocoding])

  return [mapId, ref]
}
