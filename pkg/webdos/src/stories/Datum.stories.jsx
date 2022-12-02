import React from 'react'
import { Datum, Glass } from '..'
import Debug from 'debug'

import data from './data'
const childName = data.small.child('customers').network[0].path
export default {
  title: 'Datum',
  component: Datum,
  args: {
    complex: data.small.child('customers').child(childName),
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

export const Customer = Template.bind({})
