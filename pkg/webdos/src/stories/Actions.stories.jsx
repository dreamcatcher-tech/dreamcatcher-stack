import React from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { system, api } from '@dreamcatcher-tech/interblock'
import { Actions } from '../components'
const { shell } = system
const { schemaToFunctions } = api
const actions = schemaToFunctions(shell.api)
export default {
  title: 'Actions',
  component: Actions,
  args: {
    actions,
  },
}

const Template = (args) => <Actions {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
