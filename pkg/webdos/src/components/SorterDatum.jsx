import { api } from '@dreamcatcher-tech/interblock'
import React, { useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Sorter } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
import assert from 'assert-fast'

const debug = Debug('terminal:widgets:SorterDatum')

export default function SorterDatum({ complex, viewonly, editing }) {
  assert(!viewonly || !editing, 'viewonly and editing are mutually exclusive')
  debug('props', { complex, viewonly, editing })
  const { order: items } = complex.state.formData
  const mapping = apps.crm.utils.mapCustomers(complex)
  debug('mapping complete')
  const onSort = (items) => {
    debug(`onSort: `, items)
  }
  const [formData, setFormData] = useState(items)
  const [isPending, setIsPending] = useState(false)
  const [isEditing, setIsEditing] = useState(editing)
  const [startingState, setStartingState] = useState(complex.state)
  if (startingState !== complex.state) {
    debug('state changed', startingState, complex.state)
    setStartingState(complex.state)
    // setFormData(complex.state.formData)
    // TODO alert if changes not saved
  }
  const isDirty = formData !== items
  debug('isDirty', isDirty)
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setFormData(formData)
  }

  const onSubmit = () => {
    debug('onSubmit', formData)
    setIsEditing(false)
    // setIsPending(true)
    // complex.actions.set(formData).then(() => setIsPending(false))
  }
  const onSave = (e) => {
    debug('onSave', e)
  }
  const onCancel = (e) => {
    debug('onCancel', e)
    setIsEditing(false)
    if (isDirty) {
      setFormData(items)
    }
  }
  const Editing = (
    <>
      <IconButton aria-label="save" onClick={onSave}>
        <Save color="primary" />
      </IconButton>
      <IconButton aria-label="cancel" onClick={onCancel}>
        <Cancel color="secondary" />
      </IconButton>
    </>
  )
  const onEdit = (e) => {
    debug('onEdit', e)
    setIsEditing(true)
  }
  const Viewing = (
    <IconButton aria-label="edit" onClick={onEdit}>
      <Edit color="primary" />
    </IconButton>
  )
  let { schema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
  }
  const orderSchema = schema.properties.order
  const { title } = orderSchema
  const displayableItems = items.length > 4 ? 4 : items.length
  const totalItemHeight = displayableItems * Sorter.ITEM_SIZE
  const cardHeaderHeight = 64.02
  const cardBottomPadding = 24
  const minHeight = cardHeaderHeight + totalItemHeight + cardBottomPadding
  return (
    <Card
      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight }}
    >
      <CardHeader
        title={title + ` (${items.length})`}
        action={isEditing ? Editing : viewonly ? null : Viewing}
      />
      <CardContent sx={{ flexGrow: 1, p: 0 }}>
        <Sorter {...{ items, mapping, onSort, onChange, formData }} />
      </CardContent>
    </Card>
  )
}
SorterDatum.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  /**
   * Show no edit button - all fields are readonly
   */
  viewonly: PropTypes.bool,
  /**
   * Used in testing to start the component in editing mode
   */
  editing: PropTypes.bool,
}
