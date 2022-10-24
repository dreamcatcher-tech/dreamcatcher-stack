import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { apps } from '@dreamcatcher-tech/interblock'
import { Datum } from '../components'
const { state } = apps.dbSyncer

export default {
  title: 'DbSync',
  component: Datum,
  args: {
    state,
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

const Template = (args) => <Datum {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Syncing = Template.bind({})
export const Error = Template.bind({})
