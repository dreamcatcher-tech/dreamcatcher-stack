import { Crisp } from '@dreamcatcher-tech/interblock'
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
import equals from 'fast-deep-equal'
import assert from 'assert-fast'
import ApproveAll from '@mui/icons-material/DoneAll'

const debug = Debug('terminal:widgets:SorterDatum')

function SorterDatum({ crisp, viewOnly, onOrder, onEdit, editing }) {
  assert(!viewOnly || !editing, 'viewOnly and editing are mutually exclusive')
  const { order = [], unapproved = [] } = crisp.state.formData || {}
  debug('order', crisp.state.formData)
  const [items, setItems] = useState(order)
  const [isPending, setIsPending] = useState(false)
  const [isEditing, setIsEditing] = useState(editing)
  const [initialOrder, setInitialOrder] = useState(order)
  if (!equals(initialOrder, order)) {
    debug('initialOrder !== order')
    if (isEditing) {
      debug('state changed', initialOrder, order)
    }
    setInitialOrder(order)
    setItems(order)
    // TODO alert if changes not saved
  }
  const isDirty = !equals(items, order)
  debug('isDirty', isDirty)
  const marker = crisp.getSelectedChild()
  const onMarker = (marker) => {
    debug('onMarker', marker)
    if (!marker) {
      crisp.actions.cd(crisp.absolutePath)
    } else {
      assert(order.includes(marker), `order does not include ${marker}`)
      const path = crisp.absolutePath + '/' + marker
      const allowVirtual = true
      crisp.actions.cd(path, allowVirtual)
    }
  }
  const onIsEditing = (isEditing) => {
    debug('onIsEditing', isEditing)
    setIsEditing(isEditing)
    onEdit && onEdit(isEditing)
  }
  const onSort = (items) => {
    debug(`onSort`)
    assert(items !== order, 'items are equal to order')
    setItems(items)
    onOrder(items)
  }
  const onSubmit = () => {
    debug('onSubmit', items)
    setIsPending(true)
    const formData = { ...crisp.state.formData, order: items }
    crisp.actions.set(formData).then(() => {
      setIsPending(false)
      onIsEditing(false)
      onOrder()
    })
  }
  const onCancel = () => {
    debug('onCancel')
    onIsEditing(false)
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
  const onStartEdit = (e) => {
    debug('onEdit', e)
    assert(!viewOnly, 'viewOnly is true')
    onIsEditing(true)
  }
  const Viewing = (
    <IconButton aria-label="edit" onClick={onStartEdit}>
      <Edit color="primary" />
    </IconButton>
  )
  const actions = isEditing
    ? Editing
    : viewOnly || !items.length
    ? null
    : Viewing

  let { schema } = crisp.state
  if (schema === '..' && crisp.parent.state.template?.schema) {
    schema = crisp.parent.state.template.schema
  }
  const orderSchema = schema?.properties.order
  const { title = '(loading)' } = orderSchema || {}
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
          enrich={enrichCustomers(crisp)}
          selected={marker}
          onSort={viewOnly || !isEditing || isPending ? undefined : onSort}
          onSelected={onMarker}
        />
      </CardContent>
    </Card>
  )
}
SorterDatum.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),

  /**
   * Show no edit button - all fields are readonly
   */
  viewOnly: PropTypes.bool,

  /**
   * Notify when the order changes so the map markers labesl can update
   */
  onOrder: PropTypes.func,

  /**
   * Notify when the component starts and stops editing
   */
  onEdit: PropTypes.func,

  /**
   * Testing only: start the component in editing mode
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
const enrichCustomers = (sector, customers) => {
  assert(sector instanceof Crisp)
  assert(!customers || customers instanceof Crisp)
  return (id = '') => {
    assert.strictEqual(typeof id, 'string', `id must be a string, got ${id}`)
    if (!customers || customers.isLoading || !customers.hasChild(id)) {
      return id
    }
    const customer = customers.getChild(id)
    const value = customer.state.formData.serviceAddress
    return value || id
  }
}
export default SorterDatum
