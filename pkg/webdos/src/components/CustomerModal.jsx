import bytes from 'pretty-bytes'
import { Datum } from '.'
import { Crisp } from '@dreamcatcher-tech/interblock'
import Stack from '@mui/material/Stack'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import OpenInNew from '@mui/icons-material/OpenInNew'
import Download from '@mui/icons-material/Download'
import Button from '@mui/material/Button'
import React, { useEffect, useState } from 'react'
import Debug from 'debug'
import PropTypes from 'prop-types'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

const debug = Debug('webdos:components:CustomerModal')
const CustomerModal = ({ customer, onClose }) => {
  if (!customer) {
    return null
  }
  const { custNo = '(loading...)', name = '' } = customer.state.formData || {}
  const title = `Customer ${custNo} ${name}`
  const [open, setOpen] = useState(!!customer)
  const [isEditing, setIsEditing] = useState(false)
  const onCloseSafely = () => {
    if (isEditing) {
      debug('not closing because isEditing')
      return
    }
    setOpen(false)
    onClose && onClose()
  }
  const onEditChange = (isEditing) => {
    setIsEditing(isEditing)
  }
  return (
    <Dialog onClose={onCloseSafely} open={open} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Datum crisp={customer} onEditChange={onEditChange} />
      </DialogContent>
      <DialogActions disableSpacing>
        {/* <Stack direction="row" spacing={2}>
          <Button
            disabled={!url}
            variant="contained"
            href={url}
            target="_blank"
            type="application/pdf"
          >
            Open&nbsp; <OpenInNew />
          </Button>
          <Button
            disabled={!url}
            variant="contained"
            href={url}
            download={filename}
          >
            Download&nbsp; <Download />
          </Button>
          <Button onClick={close}>Cancel</Button>
        </Stack> */}
      </DialogActions>
    </Dialog>
  )
}
CustomerModal.propTypes = {
  /**
   * If provided, the dialog will be opened.
   */
  customer: PropTypes.instanceOf(Crisp),

  /**
   * Called when the dialog is closed.
   */
  onClose: PropTypes.func,
}

export default CustomerModal
