import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { Box } from '@mui/material'
import { Routing } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
const { faker } = apps
import Debug from 'debug'

export default {
  title: 'Routing',
  component: Routing,
  args: {
    complex: faker.child('routing'),
  },
}

const Template = (args) => {
  Debug.enable('*Routing')
  return <Routing {...args} />
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Blank = Template.bind({})
Blank.args = {
  complex: faker.child('routing').setNetwork([]),
}
