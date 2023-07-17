import Stack from '@mui/material/Stack'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import ListItemButton from '@mui/material/ListItemButton'
import MapIcon from '@mui/icons-material/Map'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
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
import { ListItem } from '@mui/material'

const debug = Debug('webdos:components:Services')

const Services = ({ crisp, onEdit, editing = false }) => {
  const [expanded, setExpanded] = useState(true)
  const onExpand = (e, isExpanded) => {
    setExpanded(isExpanded)
  }
  /**
   * Show also if this service has been approved or not
   * Show if need some update sent out to customer if their service changes
   *
   * A service has:
   * 1. a start date
   * 2. an optional end date
   * 3. a service type
   * 4. a next service date
   * 5. a price with an override ability
   *
   * The list of services needs to be held somewhere.
   *
   * Things this component needs are:
   * 1. the routing sector, so it can find what sector it belongs to
   * 2. the pricing table
   * 3. the customer record
   *
   * If the
   * Show possible start dates and highlight the resulting dates
   */
  return (
    <Card>
      <Accordion expanded={expanded} onChange={onExpand}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon fontSize="large" />}
          sx={{ display: 'flex' }}
        >
          <CardHeader title="Services" sx={{ p: 0, flexGrow: 1 }} />
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={2}>
            <ListItemButton>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'red' }}>
                  <MapIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={'primary'} />
            </ListItemButton>
            <ListItem>
              <ListItemText
                primary={'Earliest possible: 2022-03-43 (in 7 days)'}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={'Next Scheduled: 2022-03-53 (in 14 days)'}
              />
            </ListItem>
            <Card>
              <CardContent>
                <Typography
                  sx={{ fontSize: 14 }}
                  color="text.secondary"
                  gutterBottom
                >
                  Word of the Day
                </Typography>
                <Typography variant="h5" component="div">
                  be - nev - o - lent
                </Typography>
                <Typography sx={{ mb: 1.5 }} color="text.secondary">
                  adjective
                </Typography>
                <Typography variant="body2">
                  well meaning and kindly.
                  <br />
                  {'"a benevolent smile"'}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small">Learn More</Button>
              </CardActions>
            </Card>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
Services.propTypes = {
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
export default Services
