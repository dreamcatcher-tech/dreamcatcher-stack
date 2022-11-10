import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { apps } from '@dreamcatcher-tech/interblock'
import { Datum } from '..'
import assert from 'assert-fast'
const { crm } = apps
const customers = crm.faker().child('customers')
export default {
  title: 'Datum',
  component: Datum,
  args: {
    complex: customers.child(customers.network[0].path),
  },
}

const Template = (args) => <Datum {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Customer = Template.bind({})
