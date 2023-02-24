import React from 'react'
import { apps } from '@dreamcatcher-tech/interblock'
import { Engine, Syncer } from '..'
import { Datum, Glass } from '../components'
import Debug from 'debug'

const add = { path: 'settings', installer: '/dpkg/crm/settings' }
export default {
  title: 'Settings',
  component: Datum,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/settings',
    init: [{ add }],
  },
}

const Template = (args) => {
  Debug.enable('*Engine Interpulse')
  return (
    <Glass.Container>
      <Glass.Left>
        <Engine {...args}>
          <Syncer path={args.path}>
            <Datum {...args} />
          </Syncer>
        </Engine>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Basic = Template.bind({})
