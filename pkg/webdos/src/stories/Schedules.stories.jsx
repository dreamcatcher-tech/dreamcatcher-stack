import React from 'react'
import { Engine, Syncer, Schedules } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'

const runDate = '2023-01-23'
const { faker } = apps.crm
const install = { add: { path: '/app', installer: '/crm' } }
const sectorsBatch = faker.routing.generateBatch(1)
const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 1)
const listInsert = { '/app/customers/batch': { batch: listBatch } }
const update = { '/app/routing/update': { path: '/app/customers' } }
const cd = { cd: { path: `/app/schedules/${runDate}`, allowVirtual: true } }
const approve = { '/app/routing/approve': { sectorId: '0', approveAll: true } }
const create = {
  '/app/schedules/create': {
    runDate,
    routing: '/app/routing',
    customers: '/app/customers',
  },
}

const init = [install, sectorsInsert, listInsert, update, cd, approve]

export default {
  title: 'Schedules',
  component: Schedules,
  args: {
    dev: { '/crm': apps.crm.covenant },
    init,
  },
}

const Template = (args) => {
  Debug.enable('iplog *Schedules crm:routing *SorterDatum')
  return (
    <Engine {...args}>
      <Syncer path="/app">
        <Syncer.UnWrapper path="schedules">
          <Schedules {...args} />
        </Syncer.UnWrapper>
      </Syncer>
    </Engine>
  )
}

export const Blank = Template.bind({})

export const Scheduled = Template.bind({})
Scheduled.args = {
  init: [...init, create],
}

// no date selected
// saved with modified sectors
// unpublish
