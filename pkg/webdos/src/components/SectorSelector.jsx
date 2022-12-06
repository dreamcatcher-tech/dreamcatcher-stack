import * as React from 'react'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import ListItemText from '@mui/material/ListItemText'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import Avatar from '@mui/material/Avatar'
import MapIcon from '@mui/icons-material/Map'
import PropTypes from 'prop-types'
import ListItemButton from '@mui/material/ListItemButton'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Debug from 'debug'
import assert from 'assert-fast'
import { api } from '@dreamcatcher-tech/interblock'
const debug = Debug('webdos:SectorSelector')

export default function SectorSelector({
  onSelected,
  complex,
  selected,
  expanded,
}) {
  if (complex.network.length && !selected) {
    selected = complex.network[0].path
  }
  if (complex.network.length) {
    assert(complex.hasChild(selected), `selected must exist: ${selected}`)
  }
  const onChange = (event, value) => {
    debug('onChange', value)
    onSelected(value.path)
    setOpen(false)
  }
  const [open, setOpen] = React.useState(expanded)
  let openProps = expanded
    ? { open, onOpen: () => setOpen(true), onClose: () => setOpen(false) }
    : {}
  const options = complex.network.map(({ path }) => {
    const sector = complex.child(path)
    return { path, sector }
  })
  const value = options.find(({ path }) => path === selected)
  return (
    <Paper>
      <Autocomplete
        options={options}
        getOptionLabel={({ sector }) => sector.state.formData.name}
        disableClearable
        fullWidth
        noOptionsText="No sectors present"
        selectOnFocus={false}
        openOnFocus
        onChange={onChange}
        value={value}
        blurOnSelect
        {...openProps}
        renderOption={(props, { path, sector }) => (
          <Sector {...{ selected, path, sector, ...props }} />
        )}
        renderInput={(params) => {
          return (
            <TextField
              {...params}
              label="Selected Sector"
              inputProps={{
                ...params.inputProps,
                readOnly: true,
                autoComplete: 'new-password', // disable autocomplete and autofill
                placeholder: 'No sectors present',
              }}
            />
          )
        }}
      />
    </Paper>
  )
}
SectorSelector.propTypes = {
  selected: PropTypes.string,
  onSelected: PropTypes.func,
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  /**
   * Used for testing only
   */
  expanded: PropTypes.bool,
}
SectorSelector.defaultProps = { expanded: false }

const Sector = ({ selected, path, sector, ...props }) => {
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
    <ListItemButton selected={selected === path} {...props}>
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
