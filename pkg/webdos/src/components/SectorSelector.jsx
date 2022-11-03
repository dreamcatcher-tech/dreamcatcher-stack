import * as React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import ImageIcon from '@mui/icons-material/Image'
import MapIcon from '@mui/icons-material/Map'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import PropTypes from 'prop-types'
import { Card, CardContent, ListItemButton, Stack } from '@mui/material'
import Debug from 'debug'
const debug = Debug('webdos:SectorSelector')

const Sector = ({ selected, onSelected, sector }) => {
  const { name, next, color } = sector
  debug(sector)
  const onClick = () => onSelected(name)
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
  sector: PropTypes.object,
}

export default function SectorSelector(props) {
  const { selected, onSelected, expanded, sectors } = props
  return (
    <Card>
      <Accordion defaultExpanded={expanded}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Sector: {selected}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List sx={{ width: '100%' }} dense>
            {sectors.map((sector, key) => {
              return <Sector {...{ selected, onSelected, sector }} key={key} />
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
  sectors: PropTypes.array,
}
SectorSelector.defaultProps = {
  selected: 'Default',
  sectors: [],
}
