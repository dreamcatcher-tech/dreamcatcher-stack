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
      status: 'THINKING',
    },
    {
      type: 'GOAL',
      titles: ['CRM', 'list customers'],
      summary: 'list all customers',
      status: 'THINKING',
    },
    {
      type: 'GOAL',
      titles: ['CRM', 'list customers'],
      summary: 'list all customers',
      status: 'DONE',
    },
    {
      type: 'HAL',
      steps: [
        {
          id: 'step_evddfrLyNpMuc3JuzAzXabcG',
          type: 'tools',
          status: 'THINKING',
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
    {
      type: 'GOAL',
      titles: ['HELP'],
      summary: 'Find out what capabilities are present',
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

/**
Hey goalie, here's the thread you're currently on,
here's a list of other threads we are tracking,
and here's the latest message.

Want it to signal any changes to any goals in the list, but only the one we switch to.

If I switch goals, should I get back the text about the goal I was on before ?
Or should I see the text in pure chronological order ?


Goalie could be the only thing that has a single big thread ?
Its responses modify the threads that HAL can see and work on.

Multigoaling seems hard to deal with ?
Goalie must be able to call multiple goals at once, so the outcome is an array,
in priority order.

and, is the goal done or not ?
So after HAL speaks, maybe the goalie should rerun, and see if the goal needs
to be updated, or if it's done.

function *process() {
  globalThread: everything that dave and HAL have said and prior goal responses
  functions: switch, add, update, prioritize
}

function list(){
  // allow specific indicies, or a version of ls that includes the state of the child
}

function add( titles, summary ) {
  // add the goal, returning its id
}

function update( id, titles, summary ) {

}
function close( id, reason ) {
  // completed, irrelevant, failed
}
function prioritize( p1, p2, p3, ... ) {

}


Use an echo bot that inserts a message into the thread as tho it was HAL
 */
