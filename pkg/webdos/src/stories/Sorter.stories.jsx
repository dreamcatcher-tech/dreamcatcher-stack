import React from 'react'
import { Glass, Datum, Sorter } from '..'
import Debug from 'debug'
import data from './data'
import assert from 'assert-fast'
import { api } from '@dreamcatcher-tech/interblock'
const debug = Debug('Sorter')
const complex = data.small.child('routing').child('13')
export default {
  title: 'Sorter',
  component: Sorter,
  args: {
    complex,
  },
}

const mapCustomers = (sector) => {
  assert(sector instanceof api.Complex)
  const { state } = sector
  const { order } = state.formData
  const mapping = new Map()
  const customers = sector.tree.child('customers')
  order.forEach((id) => {
    const customer = customers.child(id)
    const value = customer.state.formData.serviceAddress
    mapping.set(id, value)
  })
  return mapping
}

const Template = (args) => {
  Debug.enable('*Datum *Sorter')
  const mapping = mapCustomers(args.complex)
  const { order } = args.complex.state.formData
  const [items, setItems] = React.useState(order)
  const [selected, setSelected] = React.useState(args.selected)
  const onSelect = (id) => {
    debug('onSelect', id)
    setSelected(id)
  }
  const onSort = args.onSort === false ? undefined : setItems
  debug('selected', selected)
  args = { ...args, items, mapping, onSort, onSelect, selected }
  return (
    <Glass.Container>
      <Glass.Left>
        <div
          style={{
            minHeight: 800,
            minWidth: 350,
            padding: '10px',
            border: 'solid',
            backgroundColor: 'blue',
          }}
        >
          <div style={{ backgroundColor: 'white', height: '100%' }}>
            <Sorter {...args} />
          </div>
        </div>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Small = Template.bind({})
export const Blank = Template.bind({})
const blank = {
  ...complex.state,
  formData: { ...complex.state.formData, order: [] },
}
Blank.args = { complex: complex.setState(blank) }

export const Medium = Template.bind({})
const medium = data.medium.child('routing').child('13')
Medium.args = {
  complex: medium,
}
export const Large = Template.bind({})
Large.args = {
  complex: data.large.child('routing').child('13'),
}
export const Selected = Template.bind({})
Selected.args = {
  complex: medium,
  selected: medium.state.formData.order[0],
}
export const ReadOnly = Template.bind({})
ReadOnly.args = {
  onSort: false,
  complex: medium,
}
