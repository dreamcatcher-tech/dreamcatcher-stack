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
export default function Manifest({ expanded, complex, selected }) {
  // TODO assert the state is a small collection object
  const { isPublished, isReconciled } = complex.state.formData
  debug('Manifest', { complex, selected })
  if (!selected && complex.network.length) {
    selected = complex.network[0].path
  }
  const sector = complex.hasChild(selected)
    ? complex.child(selected)
    : undefined

  const manifestTemplate = complex.parent().state.template
  // due to this being a nested collection
  const sectorTemplate = manifestTemplate.template
  debug('template', sectorTemplate)

  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction={'row'} spacing={1}>
          <Typography>Manifest status:</Typography>
          <Status label={'published'} isPositive={isPublished} />
          <Status label={'reconciled'} isPositive={isReconciled} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ height: '100%' }}>
        <InnerCollection complex={sector} template={sectorTemplate} />
      </AccordionDetails>
    </Accordion>
  )
}
Manifest.propTypes = {
  expanded: PropTypes.bool,
  complex: PropTypes.instanceOf(api.Complex),
  /**
   * The selected sector
   */
  selected: PropTypes.string,
}
