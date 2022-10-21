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
const wrap = (children) => {
  return (
    <div
      style={{
        minHeight: '320px',
        width: '100%',
        height: '100%',
        background: 'purple',
        display: 'flex',
      }}
    >
      {children}
    </div>
  )
}
const Template = (args) => wrap(<Map {...args} />)

export const Basic = Template.bind({})

export const Dragging = Template.bind({})

export const OverDraw = (args) => {
  const button = (
    <Button sx={{ bgcolor: 'red', height: 30, m: 5 }}>TEST BUTTON</Button>
  )
  return wrap(
    <>
      <Map {...args} />
      {button}
      {button}
    </>
  )
}
