import { default as BaseFab } from '@mui/material/Fab'
import CreateIcon from '@mui/icons-material/Create'
import MintIcon from '@mui/icons-material/AutoFixHigh'
import FundIcon from '@mui/icons-material/SwitchAccessShortcut'
import DisputeIcon from '@mui/icons-material/LocalFireDepartment'
import SolveIcon from '@mui/icons-material/TipsAndUpdates'
import { green, purple, amber, red, lightGreen } from '@mui/material/colors'
import React, { useState, useMemo } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import PropTypes from 'prop-types'
const fabCreateStyle = {
  position: 'absolute',
  bottom: 16,
  right: 16,
  mr: 3,
  color: 'common.white',
  bgcolor: green[500],
  '&:hover': {
    bgcolor: green[600],
  },
  width: 130,
}
const fabMintStyle = {
  ...fabCreateStyle,
  bgcolor: purple[500],
  '&:hover': {
    bgcolor: purple[600],
  },
}
const fabFundStyle = {
  ...fabCreateStyle,
  color: 'common.black',
  bgcolor: amber[500],
  '&:hover': {
    bgcolor: amber[600],
  },
}
const fabDisputeStyle = {
  ...fabCreateStyle,
  color: 'common.black',
  bgcolor: red[500],
  '&:hover': {
    bgcolor: red[600],
  },
}
const fabSolveStyle = {
  ...fabCreateStyle,
  bgcolor: green[500],
  '&:hover': {
    bgcolor: green[600],
  },
}

const Fab = ({ type, onClick, disabled }) => {
  switch (type) {
    case 'create':
      return (
        <BaseFab
          variant="extended"
          sx={fabCreateStyle}
          onClick={onClick}
          disabled={disabled}
        >
          <CreateIcon sx={{ mr: 1 }} />
          Create
        </BaseFab>
      )
    case 'mint':
      return (
        <BaseFab
          variant="extended"
          sx={fabMintStyle}
          onClick={onClick}
          disabled={disabled}
        >
          <MintIcon sx={{ mr: 1 }} />
          Mint
        </BaseFab>
      )
    case 'fund':
      return (
        <BaseFab
          variant="extended"
          sx={fabFundStyle}
          onClick={onClick}
          disabled={disabled}
        >
          <FundIcon sx={{ mr: 1 }} />
          Fund
        </BaseFab>
      )
    case 'dispute':
      return (
        <BaseFab
          variant="extended"
          sx={fabDisputeStyle}
          onClick={onClick}
          disabled={disabled}
        >
          <DisputeIcon sx={{ mr: 1 }} />
          Dispute
        </BaseFab>
      )
    case 'solve':
      return (
        <BaseFab
          variant="extended"
          sx={fabSolveStyle}
          onClick={onClick}
          disabled={disabled}
        >
          <SolveIcon sx={{ mr: 1 }} />
          Solve
        </BaseFab>
      )
  }
}
Fab.propTypes = {
  type: PropTypes.oneOf(['create', 'mint', 'fund', 'dispute', 'solve'])
    .isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
}
export default Fab
