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
import { Crisp } from '@dreamcatcher-tech/interblock'
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
export default function Manifest({ crisp, expanded, width, height }) {
  debug('Manifest w h', width, height)
  const { publishedDate, reconciledDate } = crisp.state.formData || {}
  const sector = crisp.getSelectedChild()
  debug('Manifest', crisp, sector)
  const sectorCrisp =
    sector && crisp.hasChild(sector) ? crisp.getChild(sector) : undefined

  const manifestTemplate = crisp.parent.state.template
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
          <Typography>
            Manifest status:{crisp.isLoading ? ' (Loading...)' : ''}
          </Typography>
          <Status label={'published'} isPositive={!!publishedDate} />
          <Status label={'reconciled'} isPositive={!!reconciledDate} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Box sx={{ height: gridHeight }}>
          {gridHeight > 0 && (
            <InnerCollection crisp={sectorCrisp} template={sectorTemplate} />
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
Manifest.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),

  /** Is the manifest expanded by default */
  expanded: PropTypes.bool,

  /**
   * Passed down from Glass.Center, because CSS is hard
   */
  width: PropTypes.number,

  /**
   * Passed down from Glass.Center, because CSS is hard
   */
  height: PropTypes.number,
}
