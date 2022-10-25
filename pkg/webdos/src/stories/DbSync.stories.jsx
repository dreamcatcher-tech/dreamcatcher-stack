import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { apps, api } from '@dreamcatcher-tech/interblock'
import { Datum } from '../components'
const { state } = apps.dbSyncer
const actions = api.schemaToFunctions(apps.dbSyncer.api)
import Debug from 'debug'
Debug.enable('*Datum')

export default {
  title: 'DbSync',
  component: Datum,
  args: {
    state,
    network: [],
    actions,
  },
}

const Template = (args) => <Datum {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Syncing = Template.bind({})
export const Error = Template.bind({})
