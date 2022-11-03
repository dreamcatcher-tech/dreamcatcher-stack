import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { Box } from '@mui/material'
import { Routing } from '../../components'

export default {
  title: 'Routing',
  component: Routing,
  args: {
    state: {},
    network: [
      {
        path: 'Sector 1',
        state: {
          // geojson for sectors
        },
      },
      { path: 'Sector 2' },
    ],
  },
}

const Template = (args) => {
  return <Routing {...args} />
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
