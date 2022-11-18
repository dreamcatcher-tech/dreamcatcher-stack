import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
import { Schedule } from '..'
import Debug from 'debug'
const { crm } = apps

export default {
  title: 'Schedule',
  component: Schedule,
  args: {
    complex: crm.faker().child('schedule'),
  },
}

const Template = (args) => {
  Debug.enable('*Schedule')
  return <Schedule {...args} />
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Manifest = Template.bind({})
Manifest.args = { expanded: true }
