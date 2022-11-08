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
import { api } from '@dreamcatcher-tech/interblock'
const debug = Debug('webdos:SectorSelector')

export default function SectorSelector(props) {
  const { onSelected, complex } = props
  let { selected } = props
  if (complex.network.length && !selected) {
    selected = complex.network[0].path
  }
  let selectedName = '(No sectors present)'
  let selectedCount = ''
  if (selected) {
    assert(complex.hasChild(selected), `selected must exist: ${selected}`)
    const child = complex.child(selected)
    selectedName = child.state.formData.name
    selectedCount = child.state.formData.order.length
  }
  const onClick = (path) => {
    onSelected(path)
    setExpanded(false)
  }
  const [expanded, setExpanded] = React.useState(props.expanded)

  return (
    <Card>
      <Accordion expanded={expanded} onChange={(_, exp) => setExpanded(exp)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Sector: {selectedName} </Typography>
          <Typography fontStyle="italic">&nbsp;({selectedCount})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List sx={{ width: '100%' }} dense>
            {complex.network.map(({ path }, key) => {
              const sector = complex.child(path)
              return (
                <Sector {...{ selected, onClick, path, sector }} key={key} />
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
  complex: PropTypes.instanceOf(api.Complex).isRequired,
}
SectorSelector.defaultProps = { expanded: false }

const Sector = ({ selected, onClick, path, sector }) => {
  const { state } = sector
  const { name, next, color, order } = state.formData
  const primary = (
    <>
      <Typography component="span">{name}</Typography>
      <Typography component="span" fontStyle="italic">
        &nbsp;({order.length})
      </Typography>
    </>
  )
  return (
    <ListItemButton selected={selected === name} onClick={() => onClick(path)}>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: color }}>
          <MapIcon />
        </Avatar>
      </ListItemAvatar>
      <ListItemText primary={primary} />
    </ListItemButton>
  )
}
Sector.propTypes = {
  selected: PropTypes.string,
  onClick: PropTypes.func,
  path: PropTypes.string,
  sector: PropTypes.instanceOf(api.Complex).isRequired,
}
