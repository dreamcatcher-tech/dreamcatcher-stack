import React from 'react'
import { Engine, Syncer, Nav } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import { car } from './data'
import Debug from 'debug'
const debug = Debug('Nav')

export default {
  title: 'Nav',
  component: Nav,
  args: { dev: { '/dpkg/crm': apps.crm.covenant }, car: car.blank },
}

const Template = (args) => {
  Debug.enable('*Nav iplog')
  return (
    <Engine {...args}>
      <Syncer path={args.car.path}>
        <Nav />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const Selection = Template.bind({})
Selection.args = { init: [{ cd: { path: '/crm/customers' } }] }

export const NoSettings = Template.bind({})
NoSettings.args = { init: [{ rm: { path: '/crm/settings' } }] }
