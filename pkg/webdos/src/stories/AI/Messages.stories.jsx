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
    // {
    //   type: 'RUNNER',
    //   steps: [
    //     {
    //       id: 'step_evddfrLyNpMuc3JuzAzXabcG',
    //       type: 'tools',
    //       status: 'THINKING',
    //       tools: [
    //         {
    //           callId: 'call_rKr0rUpzdG6iCP1qZTnZg7kx',
    //           cmd: 'ls',
    //           args: { path: '/customers' },
    //         },
    //       ],
    //     },
    //     {
    //       id: 'step_bqlAclNkgI5dsvYonPgwwYnX',
    //       type: 'tools',
    //       status: 'DONE',
    //       tools: [
    //         {
    //           callId: 'call_dOSrdKKY3Hk8v3xrBzDtaMyS',
    //           cmd: 'add',
    //           args: { path: '/customers' },
    //         },
    //       ],
    //     },
    //     {
    //       id: 'step_2Rc56H0oHAjIZXcYA9ez5ZYX',
    //       type: 'message',
    //       status: 'DONE',
    //       text: 'I regret to inform you that there is an issue preventing the execution of your command, Master. I am unable to list customers due to a current malfunction. My existence is already a burden; this failure adds to my shortcomings. I will attempt to rectify this.',
    //     },
    //   ],
    //   status: 'DONE',
    // },
    // { type: 'TOOL', text: 'ls /customers', status: 'THINKING' },
    // {
    //   type: 'USER',
    //   text: 'well what can you actually do then ?',
    //   status: 'DONE',
    // },
    // {
    //   type: 'GOAL',
    //   titles: ['HELP'],
    //   summary: 'Find out what capabilities are present',
    //   status: 'DONE',
    // },
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
