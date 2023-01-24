import React from 'react'
import { Glass, Sorter } from '..'
import Debug from 'debug'
import { apps } from '@dreamcatcher-tech/interblock'
const debug = Debug('Sorter')
export default {
  title: 'Sorter',
  component: Sorter,
  args: {},
}

const Template = (args) => {
  Debug.enable('*Datum *Sorter')
  const enrich = apps.crm.utils.enrichCustomers(args.complex)
  const { order } = args.complex.state.formData
  const [items, setItems] = React.useState(order)
  const [selected, setSelected] = React.useState(args.selected)
  const onSelected = (id) => {
    debug('onSelected', id)
    setSelected(id)
  }
  const onSort = args.onSort === false ? undefined : setItems
  debug('selected', selected)
  args = { ...args, items, enrich, onSort, onSelected, selected }
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <div
          style={{
            backgroundColor: 'lightgray',
            display: 'flex',
            height: '100vh',
          }}
        >
          <Sorter {...args} />
        </div>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Small = Template.bind({})
export const Blank = Template.bind({})

export const Medium = Template.bind({})
export const Large = Template.bind({})
export const Selected = Template.bind({})
export const ReadOnly = Template.bind({})
