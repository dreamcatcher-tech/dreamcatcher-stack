import React from 'react'
import { Engine, Syncer } from '..'
import { Datum, Glass } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('SectorDatum')
const { faker } = apps.crm
export default {
  title: 'SectorDatum',
  component: Datum,
  args: {
    dev: { '/crm': apps.crm.covenant },
    path: '/routing',
  },
}

const Template = (args) => {
  Debug.enable('*atum iplog')
  const install = { add: { path: 'routing', installer: '/crm/routing' } }
  const addSector = { 'routing/add': faker.routing.generateSingle() }
  const sectorId = '0'
  args.init = [install, addSector]
  return (
    <Glass.Container>
      <Glass.Left>
        <Engine {...args}>
          <Syncer {...args}>
            <Syncer.UnWrapper path={sectorId}>
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
export const Default = Template.bind({})
export const Editing = Template.bind({})
Editing.args = { editing: true }
