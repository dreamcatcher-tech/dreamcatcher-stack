import React from 'react'
import { Engine, Syncer, Routing } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Routing')

const { faker } = apps.crm
const sectorsAdd = { add: { path: 'routing', installer: '/dpkg/crm/routing' } }
const sectorsBatch = faker.routing.generateBatch(5)
const sectorsInsert = { 'routing/batch': { batch: sectorsBatch } }
const listAdd = { add: { path: 'customers', installer: '/dpkg/crm/customers' } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 5)
const listInsert = { 'customers/batch': { batch: listBatch } }

export default {
  title: 'Routing',
  component: Routing,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    init: [
      sectorsAdd,
      sectorsInsert,
      listAdd,
      listInsert,
      { 'routing/update': { path: '/customers' } },
      { cd: { path: '/routing' } },
    ],
  },
}

const Template = (args) => {
  Debug.enable(' *Routing  *Sorter* *SorterDatum *DatumHOC *Datum')
  return (
    <Engine {...args}>
      <Syncer>
        <Syncer.UnWrapper path="/routing">
          <Routing />
        </Syncer.UnWrapper>
      </Syncer>
    </Engine>
  )
}

export const Blank = Template.bind({})
export const Small = Template.bind({})
export const Medium = Template.bind({})
export const Large = Template.bind({})
