import Debug from 'debug'
import React from 'react'
import PropTypes from 'prop-types'
import SpeedDial from '@mui/material/SpeedDial'
import SpeedDialIcon from '@mui/material/SpeedDialIcon'
import SpeedDialAction from '@mui/material/SpeedDialAction'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import UpdateIcon from '@mui/icons-material/EditLocationAlt'

const debug = Debug('terminal:widgets:RoutingSpeedDial')

export default function SpeedDialFab(props) {
  const { initialOpen = false } = props
  const [open, setOpen] = React.useState(initialOpen)
  const handleOpen = () => setOpen(true)
  const handleClose = (on) => () => {
    debug('close')
    setOpen(false)
    on && on()
  }
  const { onUpdate, onAdd, onEdit, onDelete, disabled } = props
  const actions = [
    { icon: <UpdateIcon />, name: 'Update', on: onUpdate },
    { icon: <AddIcon />, name: 'Add', on: onAdd },
    { icon: <EditIcon />, name: 'Edit', on: onEdit },
    { icon: <DeleteIcon />, name: 'Delete', on: onDelete },
  ]

  return (
    <SpeedDial
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon icon={<EditIcon />} />}
      onClose={handleClose()}
      onOpen={handleOpen}
      open={open}
      ariaLabel="Routing Actions"
      FabProps={{ disabled }}
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          tooltipOpen
          onClick={handleClose(action.on)}
        />
      ))}
    </SpeedDial>
  )
}
SpeedDialFab.propTypes = {
  /**
   * Testing only
   */
  initialOpen: PropTypes.bool,
  onUpdate: PropTypes.func,
  onAdd: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  disabled: PropTypes.bool,
}
