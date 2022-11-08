import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { apps } from '@dreamcatcher-tech/interblock'
import { Datum } from '../components'
const { faker } = apps

const customers = faker.child('customers')
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

export const NoChildren = Template.bind({})
NoChildren.play = async ({ canvasElement }) => {
  // const canvas = within(canvasElement)
  // const loginButton = await canvas.getByRole('button', { name: /Log in/i })
  // await userEvent.click(loginButton)
}

export const WithChildren = Template.bind({})

export const MultiLevel = Template.bind({})
