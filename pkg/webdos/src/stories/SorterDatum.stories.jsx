import React from 'react'
import { Glass, SorterDatum } from '..'
import Debug from 'debug'
import delay from 'delay'
const debug = Debug('SorterDatum')
export default {
  title: 'SorterDatum',
  component: SorterDatum,
  args: {},
}

const Template = (args) => {
  Debug.enable('*Datum *Sorter *SorterDatum')
  const [marker, onMarker] = React.useState(args.marker)
  const [complex, setComplex] = React.useState(args.complex)
  const set = async (formData) => {
    debug('set', formData)
    await delay(1200)
    const next = complex.setState({ ...complex.state, formData })
    setComplex(next)
  }
  if (!complex.actions.set) {
    setComplex(complex.addAction({ set }))
  }
  const onOrder = (order) => {
    debug('onOrder', order)
  }
  args = { ...args, marker, onMarker, complex, onOrder }

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

export const Medium = Template.bind({})
export const Large = Template.bind({})
export const Selected = Template.bind({})
export const ReadOnly = Template.bind({})
ReadOnly.args = {
  viewOnly: true,
}
export const Editing = Template.bind({})
Editing.args = {
  editing: true,
}
