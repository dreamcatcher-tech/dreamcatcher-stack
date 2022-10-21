import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { apps } from '@dreamcatcher-tech/interblock'
const { state } = apps.crm.installer.network.settings

import { Datum } from '../components'
import Debug from 'debug'
Debug.enable('*Datum')

export default {
  title: 'Settings',
  component: Datum,
}

const Template = (args) => <Datum {...{ state }} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
