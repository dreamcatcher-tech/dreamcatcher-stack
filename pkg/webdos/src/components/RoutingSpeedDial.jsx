import Debug from 'debug'
import React from 'react'
import PropTypes from 'prop-types'
import SpeedDial from '@mui/material/SpeedDial'
import SpeedDialIcon from '@mui/material/SpeedDialIcon'
import SpeedDialAction from '@mui/material/SpeedDialAction'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'

const debug = Debug('terminal:widgets:SpeedDial')

const actions = [
  { icon: <AddIcon />, name: 'Add' },
  { icon: <EditIcon />, name: 'Edit' },
  { icon: <DeleteIcon />, name: 'Delete' },
]

export default function SpeedDialFab(props) {
  const { initialOpen = false } = props
  const [open, setOpen] = React.useState(initialOpen)
  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const { onAdd, onEdit, onDelete } = props

  return (
    <SpeedDial
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
      onClose={handleClose}
      onOpen={handleOpen}
      open={open}
      ariaLabel="Routing Actions"
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          tooltipOpen
          onClick={handleClose}
        />
      ))}
    </SpeedDial>
  )
}
SpeedDialFab.propTypes = {
  initialOpen: PropTypes.bool,
  onAdd: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
}
