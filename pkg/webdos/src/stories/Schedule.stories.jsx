import React from 'react'
import { Engine, Syncer, Schedule } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'

const { faker } = apps.crm
faker.customers.reset()
const install = { add: { path: '/app', installer: '/crm' } }
const sectorsBatch = faker.routing.generateBatch(2)
const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 10)
const listInsert = { '/app/customers/batch': { batch: listBatch } }
const update = { '/app/routing/update': { path: '/app/customers' } }
// const cd = { cd: { path: '/app/routing' } }

export default {
  title: 'Schedule',
  component: Schedule,
  args: {
    dev: { '/crm': apps.crm.covenant },
    init: [install, sectorsInsert, listInsert, update],
  },
}

const Template = (args) => {
  Debug.enable('iplog *Schedule *PdfModal *pdfs *UnWrapper')
  return (
    <Engine {...args}>
      <Syncer path="/app">
        <Syncer.UnWrapper path="schedule">
          <Schedule {...args} />
        </Syncer.UnWrapper>
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const Manifest = Template.bind({})
Manifest.args = { expanded: true }

// no date selected
// saved with modified sectors
// unpublish
// show with some customers that have collecitons against them

// make an auto CD piece in root that changes the directory to some defaults
// make it remember what the tail piece was of other directories, so state is restored
// might be held in Nav component
