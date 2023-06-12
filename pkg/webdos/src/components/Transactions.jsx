import CardActions from '@mui/material/CardActions'
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
import { CardContent } from '@mui/material'

const debug = Debug('webdos:components:Services')

/**
 * Should show all account actions that have taken place.
 * Allow filtering for different types of activity.
 * Show future planned events, as much as the account will allow based on funds.
 * Shows which agent made the change to the customer.
 * Filter by agent.
 */

const Transactions = ({ crisp, onEdit, editing = false }) => {
  const [expanded, setExpanded] = useState(true)
  const onExpand = (e, isExpanded) => {
    setExpanded(isExpanded)
  }
  return (
    <Card>
      <Accordion expanded={expanded} onChange={onExpand}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon fontSize="large" />}
          sx={{ display: 'flex' }}
        >
          <CardHeader title="Transactions" sx={{ p: 0, flexGrow: 1 }} />
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
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
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
Transactions.propTypes = {
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
export default Transactions
