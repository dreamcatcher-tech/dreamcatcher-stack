import DialogTitle from '@material-ui/core/DialogTitle'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import React from 'react'
import Debug from 'debug'
import { makeStyles } from '@material-ui/core'
import { useAppContainer } from '../hooks'

const debug = Debug('terminal:widgets:OpenDialog')
debug(`loaded`)

const useStyles = makeStyles({
  root: {
    position: 'absolute',
  },
  backdrop: {
    position: 'absolute',
  },
})
const OpenDialog = ({ title, children }) => {
  const classes = useStyles()
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
        classes: { root: classes.backdrop },
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
