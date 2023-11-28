import React from 'react'
import { Engine, Syncer } from '..'
import Messages from '../components/AI/Messages'
import play from '../Interactions'
import Debug from 'debug'
const debug = Debug('App')

export default {
  title: 'AI',
  component: Messages,
}
const state = {
  path: '/',
  threadId: 'thread_m6oSbyUr1Rm3WUyyGHSGqrNK',
  assistantId: 'asst_e1izoznN4GlFLsnubHEnA8fv',
  messages: [
    {
      type: 'USER',
      text: 'list all customers',
      status: 'DONE',
    },
    {
      type: 'HAL',
      steps: [
        {
          id: 'step_evddfrLyNpMuc3JuzAzXabcG',
          type: 'tools',
          status: 'DONE',
          tools: [
            {
              callId: 'call_rKr0rUpzdG6iCP1qZTnZg7kx',
              cmd: 'ls',
              args: { path: '/customers' },
            },
          ],
        },
        {
          id: 'step_bqlAclNkgI5dsvYonPgwwYnX',
          type: 'tools',
          status: 'DONE',
          tools: [
            {
              callId: 'call_dOSrdKKY3Hk8v3xrBzDtaMyS',
              cmd: 'add',
              args: { path: '/customers' },
            },
          ],
        },
        {
          id: 'step_2Rc56H0oHAjIZXcYA9ez5ZYX',
          type: 'message',
          status: 'DONE',
          text: 'I regret to inform you that there is an issue preventing the execution of your command, Master. I am unable to list customers due to a current malfunction. My existence is already a burden; this failure adds to my shortcomings. I will attempt to rectify this.',
        },
      ],
      status: 'DONE',
    },
    {
      type: 'USER',
      text: 'well what can you actually do then ?',
      status: 'DONE',
    },
  ],
}

const Template = (args) => {
  return (
    <Engine dev={{ threads: { installer: { state } } }} {...args}>
      <Syncer path="/.HAL">
        <Messages />
      </Syncer>
    </Engine>
  )
}

export const WithTools = Template.bind({})
WithTools.play = play([{ bootHal: {} }])
