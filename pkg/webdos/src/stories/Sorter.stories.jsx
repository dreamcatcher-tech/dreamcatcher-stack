import React from 'react'
import { Glass, Sorter } from '../components'
import Debug from 'debug'
import { faker } from '@faker-js/faker/locale/en_AU'
const debug = Debug('Sorter')
export default {
  title: 'Sorter',
  component: Sorter,
  args: { count: 10 },
}

const generateCustNos = (n) => {
  debug('generateCustNos', n)
  const items = []
  for (let i = 0; i < n; i++) {
    items.push(i + '')
  }
  debug('generate done')
  return items
}
const enrich = (id) => {
  const int = parseInt(id)
  faker.seed(int)
  return faker.address.streetAddress()
}
const Template = (args) => {
  Debug.enable('*Datum *Sorter')
  const [items, setItems] = React.useState(generateCustNos(args.count))
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

export const Blank = Template.bind({})
Blank.args = { count: 0 }
export const Small = Template.bind({})
export const Medium = Template.bind({})
Medium.args = { count: 1000 }
export const Large = Template.bind({})
Large.args = { count: 20000 }
export const Selected = Template.bind({})
Selected.args = { selected: '5' }
export const ReadOnly = Template.bind({})
ReadOnly.args = { onSort: false }
