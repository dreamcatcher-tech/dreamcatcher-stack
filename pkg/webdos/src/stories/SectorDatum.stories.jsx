import React from 'react'
import { Engine, Syncer, Datum, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import * as data from './data'
const debug = Debug('SectorDatum')

const install = { add: { path: 'routing', installer: '/dpkg/crm/routing' } }
const add = { 'routing/add': data.sectors[0] }
export default {
  title: 'SectorDatum',
  component: Datum,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/routing/1',
    init: [install, add],
  },
}

const Template = (args) => {
  Debug.enable('*Datum iplog')
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

export const ReadOnly = Template.bind({})
ReadOnly.args = { viewOnly: true }
export const Collapsed = Template.bind({})
Collapsed.args = { collapsed: true }
export const Viewing = Template.bind({})
export const Editing = Template.bind({})
Editing.args = { editing: true }
