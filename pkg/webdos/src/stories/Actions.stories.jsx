import React from 'react'
import { system, api } from '@dreamcatcher-tech/interblock'
import { Actions } from '..'
import Debug from 'debug'
Debug.enable('*Actions')
const { shell } = system
const { schemaToFunctions } = api

const onAction = async (action) => {
  console.log('action received:', action)
  await new Promise((r) => setTimeout(r, 800))
}
const actions = schemaToFunctions(shell.api, onAction)
export default {
  title: 'Actions',
  component: Actions,
  args: {
    actions,
    onAction,
  },
}

const Template = (args) => <Actions {...args} />

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
Basic.args = { actions: { ping: actions.ping } }
export const Shell = Template.bind({})
