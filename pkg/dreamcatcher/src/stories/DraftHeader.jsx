import PropTypes from 'prop-types'
import React, { useCallback, useState } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import Dialog from '@mui/material/Dialog'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import Slide from '@mui/material/Slide'
import Fab from './Fab'
import { Paper, Stack } from '@mui/material'
import TextField from '@mui/material/TextField'

import equals from 'fast-deep-equal'
import Box from '@mui/material/Box'
import { Stability } from './Stability'

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />
})

export default function DraftHeader({ crisp }) {
  const [initialData, setInitialData] = useState({})
  const [updates, setUpdates] = useState({})
  const handleClose = () => {
    const formData = { ...initialData, ...updates }
    if (!equals(formData, initialData)) {
      crisp.actions.set({ formData })
    }
    crisp.actions.cd('..')
  }
  if (crisp?.state?.formData && !equals(initialData, crisp.state.formData)) {
    if (crisp.state.formData) {
      setInitialData(crisp.state.formData)
      setUpdates({})
    }
  }

  const { name, description, image, time, details } = initialData

  const updated = useCallback(
    (key) => (event) => {
      const value = event.target.value
      setUpdates((state) => ({ ...state, [key]: value }))
    },
    []
  )
  return (
    <Dialog
      fullScreen
      open={!!crisp}
      onClose={handleClose}
      TransitionComponent={Transition}
    >
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            Draft Packet Header: {crisp?.name}
          </Typography>
          <Fab type="mint" disabled={crisp?.isLoadingActions} />
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <Paper sx={{ p: 2, mx: 2, textAlign: 'center' }}>
          <Stack spacing={2}>
            <Typography>
              created: <b>{time && new Date(time).toISOString()}</b>
            </Typography>
            <TextField
              fullWidth
              label="Packet Title"
              onChange={updated('name')}
              defaultValue={name}
            />
            <Stability />
            <TextField
              fullWidth
              label="Summary"
              onChange={updated('description')}
              defaultValue={description}
              multiline
              minRows={3}
            />
            <TextField
              fullWidth
              label="Details"
              onChange={updated('details')}
              defaultValue={details}
              multiline
              minRows={7}
            />
          </Stack>
        </Paper>
      </Box>
    </Dialog>
  )
}
DraftHeader.propTypes = {
  /**
   * Crisp is undefined if the modal should be closed.
   */
  crisp: PropTypes.instanceOf(Crisp),
}
