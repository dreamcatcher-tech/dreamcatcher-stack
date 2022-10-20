import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { Map } from '../components'
import Debug from 'debug'
import { Button } from '@mui/material'
const debug = Debug('*Map')

export default {
  title: 'Map',
  component: Map,
  parameters: { layout: 'fullscreen' },
  args: {},
}

const Template = (args) => {
  const button = (
    <Button sx={{ bgcolor: 'red', height: 30, m: 5 }}>TEST BUTTON</Button>
  )
  return (
    <div
      style={{
        minHeight: '200px',
        width: '100%',
        height: '100%',
        background: 'purple',
        display: 'flex',
      }}
    >
      <Map {...args} />
      {button}
      {button}
    </div>
  )
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})

export const Dragging = Template.bind({})

export const OverDraw = Template.bind({})
