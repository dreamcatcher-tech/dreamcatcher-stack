import React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import CancelIcon from '@mui/icons-material/Cancel'
import DoneIcon from '@mui/icons-material/Done'
import { api } from '@dreamcatcher-tech/interblock'
import { InnerCollection } from '.'
import Debug from 'debug'
const debug = Debug('webdos:widgets:Manifest')
const Status = ({ label, isPositive }) => {
  return (
    <Chip
      variant={isPositive ? 'filled' : 'outlined'}
      size="small"
      label={label}
      color={isPositive ? 'success' : 'error'}
      icon={isPositive ? <DoneIcon /> : <CancelIcon />}
    />
  )
}
Status.propTypes = {
  label: PropTypes.string.isRequired,
  isPositive: PropTypes.bool,
}
export default function Manifest({ expanded, complex }) {
  // TODO assert the state is a small collection object
  const { isPublished, isReconciled, runDate } = complex.state.formData
  debug(complex)
  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction={'row'} spacing={1}>
          <Typography>Manifest for {runDate}:</Typography>
          <Status label={'published'} isPositive={isPublished} />
          <Status label={'reconciled'} isPositive={isReconciled} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ height: '100%' }}>
        <InnerCollection {...{ complex }} />
      </AccordionDetails>
    </Accordion>
  )
}
Manifest.propTypes = {
  expanded: PropTypes.bool,
  complex: PropTypes.instanceOf(api.Complex),
}
