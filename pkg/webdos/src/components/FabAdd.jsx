import React from 'react'
import PropTypes from 'prop-types'
import Fab from '@mui/material/Fab'
import Add from '@mui/icons-material/Add'

const addButtonStyle = {
  margin: 0,
  top: 'auto',
  right: 20,
  bottom: 20,
  left: 'auto',
  position: 'fixed',
}

export default function FabAdd({ onClick, disabled }) {
  return (
    <Fab
      color="primary"
      style={addButtonStyle}
      onClick={onClick}
      disabled={disabled}
    >
      <Add />
    </Fab>
  )
}
FabAdd.propTypes = {
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
}
