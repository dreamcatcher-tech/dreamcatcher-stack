import React from 'react'
import { Glass, SorterDatum } from '..'
import Debug from 'debug'
import data from './data'
import delay from 'delay'
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

  const [selected, onSelected] = React.useState(args.selected)
  const [complex, setComplex] = React.useState(args.complex)
  const set = async (formData) => {
    debug('set', formData)
    await delay(800)
    const next = complex.setState({ ...complex.state, formData })
    setComplex(next)
  }
  if (!complex.actions.set) {
    setComplex(complex.addAction({ set }))
  }
  args = { ...args, selected, onSelected, complex }

  return (
    <Glass.Container>
      <Glass.Left max>
        <SorterDatum {...args} />
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
  selected: medium.state.formData.order[3],
}
export const ReadOnly = Template.bind({})
ReadOnly.args = {
  complex: medium,
  viewOnly: true,
}
export const Editing = Template.bind({})
Editing.args = {
  complex: medium,
  editing: true,
}
