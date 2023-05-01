import React from 'react'
import { Gps } from '../components'
import Debug from 'debug'

export default {
  title: 'Gps',
  component: Gps,
  parameters: { layout: 'fullscreen' },
  args: {
    center: [-37.76976, 175.27605],
    zoom: 12,
  },
}
const Template = (args) => {
  Debug.enable('*Map')
  return (
    <div style={{ height: '100vh', width: '100%', background: 'red' }}>
      <Gps {...args} />
    </div>
  )
}

export const Basic = Template.bind({})

export const Windowed = (args) => {
  return (
    <div style={{ height: '200px', width: '200px' }}>
      <Gps {...args} />
    </div>
  )
}
Windowed.parameters = { layout: 'centered' }

export const Editing = Template.bind({})
Editing.args = { editing: true }
