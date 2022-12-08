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

export default function SorterDatum({
  complex,
  marker,
  viewOnly,
  onMarker,
  onOrder,
  editing,
}) {
  assert(!viewOnly || !editing, 'viewOnly and editing are mutually exclusive')
  const { order } = complex.state.formData
  const enrich = apps.crm.utils.enrichCustomers(complex)
  const [items, setItems] = useState(order)
  const [isPending, setIsPending] = useState(false)
  const [isEditing, setIsEditing] = useState(editing)
  const [initialOrder, setInitialOrder] = useState(order)
  if (initialOrder !== order) {
    if (isEditing) {
      debug('state changed', initialOrder, order)
    }
    setInitialOrder(order)
    setItems(order)
    // TODO alert if changes not saved
  }
  const isDirty = items !== order
  debug('isDirty', isDirty)
  const onSort = (items) => {
    debug(`onSort`)
    assert(items !== order, 'items are equal to order')
    setItems(items)
    onOrder(items)
  }
  const onSubmit = () => {
    debug('onSubmit', items)
    setIsPending(true)
    const formData = { ...complex.state.formData, order: items }
    complex.actions.set(formData).then(() => {
      setIsPending(false)
      setIsEditing(false)
      onOrder()
    })
  }
  const onCancel = () => {
    debug('onCancel')
    setIsEditing(false)
    if (isDirty) {
      setItems(order)
      onOrder()
    }
  }
  const Editing = (
    <>
      <IconButton aria-label="save" onClick={onSubmit} disabled={isPending}>
        <Save color={isPending ? 'disabled' : 'primary'} />
      </IconButton>
      <IconButton aria-label="cancel" onClick={onCancel} disabled={isPending}>
        <Cancel color={isPending ? 'disabled' : 'secondary'} />
      </IconButton>
    </>
  )
  const onEdit = (e) => {
    debug('onEdit', e)
    assert(!viewOnly, 'viewOnly is true')
    setIsEditing(true)
  }
  const Viewing = (
    <IconButton aria-label="edit" onClick={onEdit}>
      <Edit color="primary" />
    </IconButton>
  )
  const actions = isEditing
    ? Editing
    : viewOnly || !items.length
    ? null
    : Viewing

  let { schema } = complex.state
  if (schema === '..') {
    schema = complex.parent().state.template.schema
  }
  const orderSchema = schema.properties.order
  const { title } = orderSchema
  const minHeight = calcMinHeight(items)
  const sx = {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight,
  }
  return (
    <Card sx={sx}>
      <CardHeader title={`${title} (${items.length})`} action={actions} />
      <CardContent sx={{ flexGrow: 1, p: 0 }}>
        <Sorter
          items={items}
          enrich={enrich}
          selected={marker}
          onSort={viewOnly || !isEditing || isPending ? undefined : onSort}
          onSelected={onMarker}
        />
      </CardContent>
    </Card>
  )
}
SorterDatum.propTypes = {
  complex: PropTypes.instanceOf(api.Complex).isRequired,
  /**
   * The selected marker id
   */
  marker: PropTypes.string,
  /**
   * Show no edit button - all fields are readonly
   */
  viewOnly: PropTypes.bool,
  /**
   * Callback when the selected marker changes
   */
  onMarker: PropTypes.func.isRequired,
  /**
   * Notify when the order changes so the map can update
   */
  onOrder: PropTypes.func.isRequired,
  /**
   * Used in testing to start the component in editing mode
   */
  editing: PropTypes.bool,
}
const calcMinHeight = (items) => {
  const displayableItems = items.length > 4 ? 4 : items.length
  const totalItemHeight = displayableItems * Sorter.ITEM_SIZE
  const cardHeaderHeight = 64.02
  const cardBottomPadding = 24
  return cardHeaderHeight + totalItemHeight + cardBottomPadding
}
