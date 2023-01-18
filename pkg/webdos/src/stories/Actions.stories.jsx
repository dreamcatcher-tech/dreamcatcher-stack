import React from 'react'
import { Engine, Syncer, Actions } from '..'
import Debug from 'debug'

export default {
  title: 'Actions',
  component: Actions,
}

const Template = () => {
  Debug.enable('*Actions iplog')
  return (
    <Engine>
      <Syncer>
        <Actions />
      </Syncer>
    </Engine>
  )
}

export const Basic = () => {
  Debug.enable('*Actions iplog')
  const Single = ({ crisp }) => {
    if (!crisp.isLoadingActions) {
      const actions = crisp.actions
      console.log('actions', actions)
      return <Actions.Action action={actions.ping} />
    }
  }
  return (
    <Engine>
      <Syncer>
        <Single />
      </Syncer>
    </Engine>
  )
}

export const Shell = Template.bind({})
