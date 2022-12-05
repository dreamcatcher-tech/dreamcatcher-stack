import List from '@mui/material/List'
import ListItemText from '@mui/material/ListItemText'
import React from 'react'
import { Glass } from '..'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeader from '@mui/material/CardHeader'
import Debug from 'debug'
import { ListItem } from '@mui/material'
Debug.enable('*Datum')
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
      <div>Single</div>
    </Glass.Left>
    <Glass.Center debug />
  </Glass.Container>
)

const FlexAccordion = () => {
  const [expanded, setExpanded] = React.useState(true)
  const onExpand = (e, expanded) => {
    setExpanded(expanded)
  }
  return (
    <Accordion expanded={expanded} onChange={onExpand} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />}>
        <CardHeader title="FlexAccordion" />
      </AccordionSummary>
      <AccordionDetails sx={{ display: 'flex' }}>
        <div>Single Item</div>
      </AccordionDetails>
    </Accordion>
  )
}

const items = Array(100)
  .fill(0)
  .map((_, i) => i)
const LargeAccordion = () => {
  const [expanded, setExpanded] = React.useState(true)
  const onExpand = (e, expanded) => {
    setExpanded(expanded)
  }
  return (
    <Accordion
      expanded={expanded}
      onChange={onExpand}
      sx={{ overflow: 'auto' }}
      disableGutters
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="large" />}>
        <CardHeader title="FlexAccordion" />
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
export const WithLargeAccordion = () => {
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <LargeAccordion />
        <FlexAccordion />
      </Glass.Left>
      <Glass.Center debug></Glass.Center>
    </Glass.Container>
  )
}

export const WithAccordions = (args) => {
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <FlexAccordion />
        <LargeAccordion />
      </Glass.Left>
      <Glass.Center debug>
        <FlexAccordion />
      </Glass.Center>
    </Glass.Container>
  )
}

export const PlainDiv = () => {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        background: 'magenta',
      }}
    ></div>
  )
}
