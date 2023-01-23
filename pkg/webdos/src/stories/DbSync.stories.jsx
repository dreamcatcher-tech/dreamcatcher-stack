import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
import { Datum, Glass } from '..'
import Debug from 'debug'
const complex = apps.crm.faker().child('settings')
export default {
  title: 'DbSync',
  component: Datum,
  args: { complex },
}

const Template = (args) => (
  <Glass.Container>
    <Glass.Left>
      <Datum {...args} />
    </Glass.Left>
  </Glass.Container>
)

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
export const Syncing = Template.bind({})
export const Error = Template.bind({})
