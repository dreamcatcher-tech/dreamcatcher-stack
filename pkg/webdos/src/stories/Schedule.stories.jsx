import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
import { Schedule } from '../components'
const { manifest } = apps

export default {
  title: 'Schedule',
  component: Schedule,
  args: {
    manifestState: manifest.state,
  },
}

const Template = (args) => <Schedule {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
