import Debug from 'debug'
import React from 'react'
import PropTypes from 'prop-types'
import SpeedDial from '@mui/material/SpeedDial'
import SpeedDialIcon from '@mui/material/SpeedDialIcon'
import SpeedDialAction from '@mui/material/SpeedDialAction'
import AddIcon from '@mui/icons-material/Add'
import CompressIcon from '@mui/icons-material/Compress'
import ExpandIcon from '@mui/icons-material/Expand'
import UnpublishedIcon from '@mui/icons-material/Unpublished'
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges'
import PrintIcon from '@mui/icons-material/Print'
const debug = Debug('terminal:widgets:SpeedDial')

const createActions = (events) => {
  const { onPublish, onUnpublish, onReconcile, onUnReconcile, onPrint } = events
  const actions = []
  // TODO move to a text key to set modes, with a single onAction handler
  if (onPublish) {
    actions.push({
      icon: <PublishedWithChangesIcon />,
      name: 'Publish',
      onClick: onPublish,
    })
  } else {
    actions.push({
      icon: <UnpublishedIcon />,
      name: 'Unpublish',
      onClick: onUnpublish,
    })
  }
  if (onReconcile) {
    actions.push({
      icon: <CompressIcon />,
      name: 'Reconcile',
      onClick: onReconcile,
    })
  } else {
    actions.push({
      icon: <ExpandIcon />,
      name: 'UnReconcile',
      onClick: onUnReconcile,
    })
  }
  actions.push({
    icon: <PrintIcon />,
    name: 'Print',
    onClick: onPrint,
  })
  return actions
}

export default function SpeedDialFab(props) {
  const { initialOpen = false, events = {} } = props
  const [open, setOpen] = React.useState(initialOpen)
  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const actions = createActions(events)

  return (
    <SpeedDial
      sx={{ position: 'absolute', bottom: 16, right: 16 }}
      icon={<SpeedDialIcon />}
      onClose={handleClose}
      onOpen={handleOpen}
      open={open}
      ariaLabel="Schedule Actions"
    >
      {actions.map((action) => (
        <SpeedDialAction
          key={action.name}
          icon={action.icon}
          tooltipTitle={action.name}
          tooltipOpen
          onClick={() => {
            handleClose()
            action.onClick()
          }}
        />
      ))}
    </SpeedDial>
  )
}
SpeedDialFab.propTypes = {
  initialOpen: PropTypes.bool,
  events: PropTypes.objectOf(PropTypes.func),
}
