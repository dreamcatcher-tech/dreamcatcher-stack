import { DialogTitle } from '@mui/material'
import { Dialog } from '@mui/material'
import { DialogContent } from '@mui/material'
import React from 'react'
import Debug from 'debug'
import { useAppContainer } from '../hooks'
import process from 'process'

const debug = Debug('terminal:widgets:OpenDialog')
debug(`loaded`)
const OpenDialog = ({ title, children }) => {
  const { element, isFocused } = useAppContainer()
  const onClose = () => {
    // TODO halt the user if blockchain is enquiring still
    const command = `cd ..\n`
    for (const c of command) {
      process.stdin.send(c)
    }
  }
  return (
    <Dialog
      scroll={'body'}
      maxWidth={'xl'}
      container={element}
      onClose={onClose}
      aria-labelledby="simple-dialog-title"
      open
      BackdropProps={{
        sx: { position: 'absolute' },
      }}
      style={{ position: 'absolute' }}
      // TODO if terminal is showing, do not grab focus
      disableEnforceFocus
      disableRestoreFocus={isFocused}
      disableAutoFocus={isFocused}
    >
      <DialogTitle id="simple-dialog-title">{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {/* <DialogActions>
            <Button autoFocus color="primary">
              Cancel
            </Button>
            <Button color="primary">Ok</Button>
          </DialogActions> */}
    </Dialog>
  )
}

export default OpenDialog
