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
  isPositive: PropTypes.bool.isRequired,
}
export default function Manifest({ expanded, isPublished, isReconciled }) {
  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction={'row'} spacing={1}>
          <Typography>Manifest:</Typography>
          <Status label={'published'} isPositive={isPublished} />
          <Status label={'reconciled'} isPositive={isReconciled} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ height: '100%' }}>meow</AccordionDetails>
    </Accordion>
  )
}
Manifest.propTypes = {
  expanded: PropTypes.bool,
  isPublished: PropTypes.bool,
  isReconciled: PropTypes.bool,
}
