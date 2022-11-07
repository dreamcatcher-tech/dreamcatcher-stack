import * as React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import MapIcon from '@mui/icons-material/Map'
import PropTypes from 'prop-types'
import { Card, CardContent, ListItemButton, Stack } from '@mui/material'
import Debug from 'debug'
import assert from 'assert-fast'
import Complex from '../Complex'
const debug = Debug('webdos:SectorSelector')

export default function SectorSelector(props) {
  const { onSelected, expanded, complex } = props
  let { selected = '' } = props
  if (complex.network.length && !selected) {
    selected = complex.network[0].path
  }
  let selectedName = '(No sectors present)'
  if (selected) {
    assert(complex.hasChild(selected), `selected must exist: ${selected}`)
    selectedName = complex.child(selected).state.formData.name
  }
  return (
    <Card>
      <Accordion defaultExpanded={expanded}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Sector: {selectedName}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List sx={{ width: '100%' }} dense>
            {complex.network.map(({ path }, key) => {
              const sector = complex.child(path)
              return (
                <Sector {...{ selected, onSelected, path, sector }} key={key} />
              )
            })}
          </List>
        </AccordionDetails>
      </Accordion>
    </Card>
  )
}
SectorSelector.propTypes = {
  selected: PropTypes.string,
  onSelected: PropTypes.func,
  expanded: PropTypes.bool,
  complex: PropTypes.instanceOf(Complex).isRequired,
}

const Sector = ({ selected, onSelected, path, sector }) => {
  const { state } = sector
  const { name, next, color } = state.formData
  const onClick = () => onSelected(path)
  return (
    <ListItemButton selected={selected === name} onClick={onClick}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: color }}>
          <MapIcon />
        </Avatar>
      </ListItemAvatar>
      <ListItemText primary={name} secondary={next} />
    </ListItemButton>
  )
}
Sector.propTypes = {
  selected: PropTypes.string,
  onSelected: PropTypes.func,
  path: PropTypes.string,
  sector: PropTypes.instanceOf(Complex).isRequired,
}
