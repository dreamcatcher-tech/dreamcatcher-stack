import React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import { Stack, Chip } from '@mui/material'
import CancelIcon from '@mui/icons-material/Cancel'
import DoneIcon from '@mui/icons-material/Done'

import { CollectionList } from '.'
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
export default function Manifest({ expanded, state }) {
  // TODO assert the state is a small collection object
  const { isPublished, isReconciled, template, rows } = state
  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction={'row'} spacing={1}>
          <Typography>Manifest:</Typography>
          <Status label={'published'} isPositive={isPublished} />
          <Status label={'reconciled'} isPositive={isReconciled} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ height: '100%' }}>
        <CollectionList {...{ template, rows }} />
      </AccordionDetails>
    </Accordion>
  )
}
Manifest.propTypes = {
  expanded: PropTypes.bool,
  state: PropTypes.object,
}
