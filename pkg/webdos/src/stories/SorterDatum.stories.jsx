import React from 'react'
import { Glass, Datum, SorterDatum } from '..'
import Debug from 'debug'
import data from './data'
import assert from 'assert-fast'
import { api, apps } from '@dreamcatcher-tech/interblock'
const debug = Debug('Sorter')
const complex = data.small.child('routing').child('13')
export default {
  title: 'SorterDatum',
  component: SorterDatum,
  args: {
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*Datum *Sorter *SorterDatum')

  const [selected, onSelect] = React.useState(args.selected)
  const [sector, onChange] = React.useState(args.sector)
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
            display: 'flex',
          }}
        >
          <SorterDatum {...args} />
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
