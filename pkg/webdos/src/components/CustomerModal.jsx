import { Datum, Gps } from '.'
import { Crisp } from '@dreamcatcher-tech/interblock'
import DialogTitle from '@mui/material/DialogTitle'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Grid from '@mui/material/Grid'

import React, { useState } from 'react'
import Debug from 'debug'
import PropTypes from 'prop-types'

const debug = Debug('webdos:components:CustomerModal')
const CustomerModal = ({ customer, onClose, editing = false }) => {
  const [formData, setFormData] = useState(customer.state.formData || {})
  const { custNo = '(loading...)', name = '' } = formData
  const title = `Customer ${custNo} ${name}`
  const [open, setOpen] = useState(!!customer)
  const [isEditingGps, setIsEditingGps] = useState(editing ?? false)
  const [isEditingDatum, setIsEditingDatum] = useState(editing ?? false)
  const isEditing = isEditingGps || isEditingDatum
  const onCloseSafely = () => {
    if (isEditing) {
      debug('not closing because isEditing')
      return
    }
    setOpen(false)
    onClose && onClose()
  }
  let { uiSchema } = customer.state || {}

  const onUpdate = (formData) => {
    debug('onChange', formData)
    setFormData(formData)
  }

  return (
    <Dialog onClose={onCloseSafely} open={open} fullWidth maxWidth="xl">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} justifyContent="center">
          <Grid item xs={6} xl={3}>
            <Datum
              crisp={customer}
              onEdit={setIsEditingDatum}
              uiSchema={uiSchema}
              onUpdate={onUpdate}
              editing={editing}
            />
          </Grid>
          <Grid item xs={6}>
            <Gps crisp={customer} onEdit={setIsEditingGps} editing={editing} />
          </Grid>
        </Grid>
      </DialogContent>
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

  /**
   * Testing: start in editing mode
   */
  editing: PropTypes.bool,
}

export default CustomerModal
