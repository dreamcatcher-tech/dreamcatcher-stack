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
const CustomerModal = ({ customer, onClose }) => {
  if (!customer) {
    return null
  }
  const [formData, setFormData] = useState(customer.state.formData || {})
  const { custNo = '(loading...)', name = '', isManualGps } = formData
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
  const onEdit = (isEditing) => {
    setIsEditing(isEditing)
  }
  let { uiSchema } = customer.state || {}

  if (!isManualGps) {
    uiSchema = { ...uiSchema, serviceAddress: { 'ui:readonly': true } }
  }
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
              onEdit={onEdit}
              uiSchema={uiSchema}
              onUpdate={onUpdate}
            />
          </Grid>
          <Grid item xs={6} sx={{ background: 'red' }}>
            <Gps edit={isEditing && !isManualGps} />
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
}

export default CustomerModal
