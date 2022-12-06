import List from '@mui/material/List'
import PropTypes from 'prop-types'
import ListItemText from '@mui/material/ListItemText'
import React from 'react'
import { Glass, Map } from '..'
import Accordion from '@mui/material/Accordion'
import Box from '@mui/material/Box'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeader from '@mui/material/CardHeader'
import Debug from 'debug'
import { ListItem } from '@mui/material'
const debug = Debug('Glass')
const enable = () => Debug.enable('*Datum *Glass')
export default {
  title: 'Glass',
  component: Glass,
}

export const Blank = () => <Glass.Container debug />
export const Empty = (args) => (
  <Glass.Container debug>
    <Glass.Left debug />
    <Glass.Center debug />
  </Glass.Container>
)
export const Single = (args) => (
  <Glass.Container debug>
    <Glass.Left debug>
      <div style={{ background: 'red' }}>Single</div>
    </Glass.Left>
    <Glass.Center debug />
  </Glass.Container>
)

const PlainAccordion = ({ title, collapsed }) => {
  const [expanded, setExpanded] = React.useState(!collapsed)
  const onExpand = (e, expanded) => {
    setExpanded(expanded)
  }
  return (
    <Accordion expanded={expanded} onChange={onExpand} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />}>
        <CardHeader title={title || 'PlainAccordion'} />
      </AccordionSummary>
      <AccordionDetails>
        <div>Single Item</div>
      </AccordionDetails>
    </Accordion>
  )
}
PlainAccordion.propTypes = {
  title: PropTypes.string,
  collapsed: PropTypes.bool,
}

const items = Array(100)
  .fill(0)
  .map((_, i) => i)
const OversizeAccordion = ({ title, collapsed }) => {
  const [expanded, setExpanded] = React.useState(!collapsed)
  const onExpand = (e, expanded) => {
    setExpanded(expanded)
  }
  return (
    <Accordion
      expanded={expanded}
      onChange={onExpand}
      disableGutters
      sx={{ overflow: 'auto', minHeight: 88.016 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />}>
        <CardHeader title={title || 'OversizeAccordion'} />
      </AccordionSummary>
      <AccordionDetails>
        <List dense disablePadding>
          {items.map((i) => {
            return (
              <ListItem key={i}>
                <ListItemText primary={`list item ${i}`} />
              </ListItem>
            )
          })}
        </List>
      </AccordionDetails>
    </Accordion>
  )
}
OversizeAccordion.propTypes = {
  title: PropTypes.string,
  collapsed: PropTypes.bool,
}
export const GreedyFiller = () => {
  enable()
  return (
    <>
      <Glass.Container debug>
        <Glass.Left debug>
          <OversizeAccordion />
          <PlainAccordion />
          <OversizeAccordion />
          <Filler />
        </Glass.Left>
        <Glass.Center debug></Glass.Center>
      </Glass.Container>
      <Map />
    </>
  )
}
const Filler = () => (
  <Box
    sx={{
      flexGrow: 1,
      background: 'red',
      minHeight: '200px',
    }}
  >
    Filler
  </Box>
)
export const Routing = () => {
  enable()
  return (
    <>
      <Glass.Container debug>
        <Glass.Left debug>
          <OversizeAccordion collapsed title="SectorSelector" />
          <PlainAccordion collapsed title="SectorDatum" />
          <Filler />
        </Glass.Left>
        <Glass.Center debug></Glass.Center>
      </Glass.Container>
      <Map />
    </>
  )
}
export const Scheduling = () => {
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <PlainAccordion title="Date" />
        <OversizeAccordion title="SectorSelector" />
        <Filler />
      </Glass.Left>
      <Glass.Center debug></Glass.Center>
    </Glass.Container>
  )
}
export const WithLargeAccordion = () => {
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <OversizeAccordion />
        <PlainAccordion />
      </Glass.Left>
      <Glass.Center debug></Glass.Center>
    </Glass.Container>
  )
}
export const TwoLargeAccordion = () => {
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <OversizeAccordion />
        <PlainAccordion />
        <OversizeAccordion />
      </Glass.Left>
      <Glass.Center debug></Glass.Center>
    </Glass.Container>
  )
}

export const WithAccordions = (args) => {
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <PlainAccordion />
        <OversizeAccordion />
      </Glass.Left>
      <Glass.Center debug>
        <PlainAccordion />
      </Glass.Center>
    </Glass.Container>
  )
}

export const WithMap = (args) => {
  return (
    <>
      <Glass.Container debug>
        <Glass.Left debug>
          <PlainAccordion />
          <OversizeAccordion />
        </Glass.Left>
        <Glass.Center debug>
          <PlainAccordion />
        </Glass.Center>
      </Glass.Container>
      <Map />
    </>
  )
}
