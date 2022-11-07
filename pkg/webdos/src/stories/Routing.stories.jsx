import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { Box } from '@mui/material'
import { Routing } from '../components'
import complex from './topProps'
import Debug from 'debug'

export default {
  title: 'Routing',
  component: Routing,
  args: {
    complex: complex.child('routing'),
  },
}

const Template = (args) => {
  Debug.enable('*Routing')
  return <Routing {...args} />
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
