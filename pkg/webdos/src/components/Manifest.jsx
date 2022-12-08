import useResizeObserver from 'use-resize-observer'
import React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
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
export default function Manifest({ expanded, complex, sector, width, height }) {
  debug('Manifest w h', width, height)
  // TODO assert the state is a small collection object
  const { isPublished, isReconciled } = complex.state.formData
  debug('Manifest', { complex, sector })
  const sectorComplex = complex.hasChild(sector)
    ? complex.child(sector)
    : undefined

  const manifestTemplate = complex.parent().state.template
  // due to this being a nested collection
  const sectorTemplate = manifestTemplate.template
  debug('template', sectorTemplate)
  const { ref, width: aw = 1, height: ah = 1 } = useResizeObserver()
  debug('accordion w h', aw, ah)
  debug('computed height', height - ah)
  const gridHeight = height - ah - 3 * 8 // 3 spacings x standard spacing
  return (
    <Accordion disableGutters defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} ref={ref}>
        <Stack direction={'row'} spacing={1}>
          <Typography>Manifest status:</Typography>
          <Status label={'published'} isPositive={isPublished} />
          <Status label={'reconciled'} isPositive={isReconciled} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ height: gridHeight }}>
          {gridHeight > 0 && (
            <InnerCollection
              complex={sectorComplex}
              template={sectorTemplate}
            />
          )}
        </Box>
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
  sector: PropTypes.string.isRequired,
  /**
   * Passed down from Glass.Center
   */
  width: PropTypes.number,
  /**
   * Passed down from Glass.Center
   */
  height: PropTypes.number,
}
