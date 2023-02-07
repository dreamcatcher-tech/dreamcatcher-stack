import React from 'react'
import { Engine, Syncer } from '..'
import { Actions } from '../components'
import Debug from 'debug'

export default {
  title: 'Actions',
  component: Actions,
}

const Template = (args) => {
  Debug.enable('*Actions iplog')
  return (
    <Engine>
      <Syncer>
        <Actions {...args} />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})
Basic.args = { include: ['ping'] }
export const ExcludePing = Template.bind({})
ExcludePing.args = { exclude: ['ping'] }

export const Shell = Template.bind({})
