import React from 'react'
import { Datum, Glass } from '..'
import data from './data'
import Debug from 'debug'
const debug = Debug('SectorDatum')

export default {
  title: 'SectorDatum',
  component: Datum,
  args: {
    complex: data.small.child('routing').child('13'),
  },
}

const Template = (args) => {
  Debug.enable('*Datum')
  return (
    <Glass.Container>
      <Glass.Left>
        <Datum {...args} />
      </Glass.Left>
    </Glass.Container>
  )
}

export const ReadOnly = Template.bind({})
ReadOnly.args = { viewOnly: true }
export const Collapsed = Template.bind({})
Collapsed.args = { collapsed: true }
export const Viewing = Template.bind({})
export const Editing = Template.bind({})
Editing.args = { editing: true }
