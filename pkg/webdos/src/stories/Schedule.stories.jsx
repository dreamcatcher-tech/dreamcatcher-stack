import React from 'react'
import { within, userEvent } from '@storybook/testing-library'

import { Schedule } from '../components'

export default {
  title: 'Schedule',
  component: Schedule,
}

const Template = (args) => <Schedule {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
