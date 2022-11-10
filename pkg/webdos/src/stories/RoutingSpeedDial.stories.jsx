import React from 'react'
import { RoutingSpeedDial } from '..'
import Debug from 'debug'
const debug = Debug('RoutingSpeedDial')

export default {
  title: 'RoutingSpeedDial',
  component: RoutingSpeedDial,
  args: { initialOpen: true },
}

const Template = (args) => {
  Debug.enable('*RoutingSpeedDial')
  return <RoutingSpeedDial {...args} />
}

export const Closed = Template.bind({})
Closed.args = { initialOpen: false }
export const Routing = Template.bind({})
Routing.args = {}
