import React from 'react'
import { Engine, Syncer, Datum, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('SectorDatum')

const install = { add: { path: 'routing', installer: '/dpkg/crm/routing' } }
console.log(apps)
const add1 = { 'routing/add': apps.crm.faker.routing[0] }
export default {
  title: 'SectorDatum',
  component: Datum,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/routing',
    init: [install, add1],
  },
}

const Template = (args) => {
  Debug.enable('*Datum* iplog')
  return (
    <Glass.Container>
      <Glass.Left>
        <Engine {...args}>
          <Syncer path={args.path}>
            <Syncer.UnWrapper path="0">
              <Datum {...args} />
            </Syncer.UnWrapper>
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
