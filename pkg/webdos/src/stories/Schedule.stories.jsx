import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
import { Schedule } from '../components'
import Debug from 'debug'
import complex from './topProps'
const { manifest } = apps

export default {
  title: 'Schedule',
  component: Schedule,
  args: {
    complex: complex.child('schedule'),
  },
}

const Template = (args) => {
  Debug.enable('*Schedule')
  return <Schedule {...args} />
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
