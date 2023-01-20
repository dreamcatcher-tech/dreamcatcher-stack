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
import { Crisp } from '@dreamcatcher-tech/interblock'
const debug = Debug('webdos:SectorSelector')

function SectorSelector({ crisp, expanded, disabled }) {
  const { wd } = crisp
  const sectors = crisp.isLoading ? [] : [...crisp]
  debug('wd %s path %s sectors %o', wd, crisp.path, sectors)
  let sector
  if (wd.startsWith(crisp.path)) {
    // if we already have a sector selected, update 'sector'
    // if we could have a sector, then select one
  }
  const onChange = (event, value) => {
    debug('onChange', value)
    onSector(value.path)
    setOpen(false)
  }
  const [open, setOpen] = React.useState(expanded)
  const openProps = expanded
    ? { open, onOpen: () => setOpen(true), onClose: () => setOpen(false) }
    : {}
  const options = sectors.map((path) => {
    const sector = crisp.getChild(path)
    return { path, sector }
  })

  const value = options.find(({ path }) => path === sector)
  return (
    <Paper>
      <Autocomplete
        disabled={disabled}
        options={options}
        getOptionLabel={({ path }) => path}
        disableClearable
        fullWidth
        noOptionsText="No sectors present"
        selectOnFocus={false}
        openOnFocus
        onChange={onChange}
        value={value}
        blurOnSelect
        {...openProps}
        renderOption={(props, value) => (
          <Sector {...{ selected: sector, ...value, ...props }} />
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
                value: value && value.sector.state.formData.name,
              }}
            />
          )
        }}
      />
    </Paper>
  )
}
SectorSelector.propTypes = {
  /**
   * The Routing Crisp to select a sector from
   */
  crisp: PropTypes.instanceOf(Crisp),

  /**
   * Disable the selector during editing
   */
  disabled: PropTypes.bool,
  /**
   * Used for testing only
   */
  expanded: PropTypes.bool,
}

const Sector = ({ selected, path, sector, ...props }) => {
  const { state } = sector
  const { name, color, order } = state.formData
  const primary = (
    <>
      <Typography component="span">{name}</Typography>
      <Typography component="span" fontStyle="italic">
        &nbsp;({order.length})
      </Typography>
    </>
  )
  return (
    <ListItemButton selected={selected === path} {...props} key={path}>
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
  sector: PropTypes.instanceOf(Crisp).isRequired,
}
export default SectorSelector
