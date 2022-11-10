import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { Gps } from '..'
import Debug from 'debug'
Debug.enable('*Map')

export default {
  title: 'Gps',
  component: Gps,
  parameters: { layout: 'fullscreen' },
  args: {
    center: [-37.76976, 175.27605],
    zoom: 12,
  },
}
const Template = (args) => <Gps {...args} />

export const Basic = Template.bind({})

export const Windowed = (args) => {
  return (
    <div style={{ height: '200px', width: '200px' }}>
      <Gps {...args} />
    </div>
  )
}
Windowed.parameters = { layout: 'centered' }
