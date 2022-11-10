import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
import { Datum } from '..'
import Debug from 'debug'
Debug.enable('*Datum')
const complex = apps.crm.faker().child('settings')
export default {
  title: 'DbSync',
  component: Datum,
  args: { complex },
}
console.log(complex)

const Template = (args) => <Datum {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Syncing = Template.bind({})
export const Error = Template.bind({})
