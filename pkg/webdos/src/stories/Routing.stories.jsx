import React from 'react'
import { Routing } from '..'
import data from './data'
import Debug from 'debug'

export default {
  title: 'Routing',
  component: Routing,
  args: {
    complex: data.small.child('routing'),
  },
}

const Template = (args) => {
  Debug.enable('*Routing')
  return <Routing {...args} />
}

export const Blank = Template.bind({})
Blank.args = {
  complex: data.small.child('routing').setNetwork([]),
}
export const Small = Template.bind({})
export const Medium = Template.bind({})
Medium.args = {
  complex: data.medium.child('routing'),
}
export const Large = Template.bind({})
Large.args = {
  complex: data.large.child('routing'),
}
