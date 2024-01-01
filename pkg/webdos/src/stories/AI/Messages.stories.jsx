import React from 'react'
import { Engine, Syncer } from '../..'
import { system } from '@dreamcatcher-tech/interblock'
import Messages from '../../components/AI/Messages'
import play from '../../Interactions'
import Debug from 'debug'
const debug = Debug('App')
const { hal } = system

export default {
  title: 'AI',
  component: Messages,
}
const state = {
  mode: 'GOALIE',
  messages: [
    {
      type: 'USER',
      text: 'list all customers',
      status: hal.STATUS.RUNNING,
    },
    {
      type: 'USER',
      text: 'asdf',
      status: hal.STATUS.DONE,
    },
    {
      type: 'GOALIE',
      text: 'Whatever do you mean, sir?',
      status: hal.STATUS.RUNNING,
    },
    {
      type: 'GOALIE',
      text: 'Whatever do you mean, sir?',
      status: hal.STATUS.DONE,
    },
    {
      type: 'GOAL',
      text: 'list all customers',
      helps: [],
      status: hal.STATUS.RUNNING,
    },
    {
      type: 'GOAL',
      text: 'list all customers',
      helps: [
        {
          type: 'Artifact',
          instructions: `**blah**
          Do some things, then *stop*`,
          done: 'check some stuff',
          tld: '/apps/crm/customers',
          cmds: ['ls', 'add', 'update', 'delete'],
        },
      ],
      status: hal.STATUS.DONE,
    },
    {
      type: 'RUNNER',
      text: 'give me the customer name',
      status: hal.STATUS.RUNNING,
    },
    {
      type: 'RUNNER',
      text: 'give me the customer name',
      status: hal.STATUS.DONE,
    },
    {
      type: 'TOOL',
      status: hal.STATUS.RUNNING,
      id: 'call_rKr0rUpzdG6iCP1qZTnZg7kx',
      cmd: '/apps/crm/customers/add',
      schema: { type: 'object', properties: { name: { type: 'string' } } },
      args: { name: 'bob' },
    },
    {
      type: 'TOOL',
      status: hal.STATUS.DONE,
      id: 'call_rKr0rUpzdG6iCP1qZTnZg7kx',
      cmd: '/apps/crm/customers/add',
      schema: { type: 'object', properties: { name: { type: 'string' } } },
      args: { name: 'bob' },
      output: { id: '123', name: 'bob' },
    },
  ],
}

const Template = (args) => {
  return (
    <Engine dev={{ hal: { installer: { state } } }} {...args}>
      <Syncer path="/.HAL">
        <Messages />
      </Syncer>
    </Engine>
  )
}

export const WithTools = Template.bind({})
WithTools.play = play([{ bootHal: {} }])
