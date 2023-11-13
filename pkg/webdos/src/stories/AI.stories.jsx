import React from 'react'
import { Engine, Syncer } from '..'
import ThreeBox from '../components/AI/ThreeBox'
import { apps } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import play from '../Interactions'
import Debug from 'debug'
const debug = Debug('App')

const { faker } = apps.crm
faker.customers.reset()
const makeInit = ({ sectors = 2, customers = 10 } = {}) => {
  const install = { add: { path: '/app', installer: '/crm' } }
  const cd = { '/cd': { path: '/app/customers' } }
  const sectorsBatch = faker.routing.generateBatch(sectors)
  const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
  const listBatch = faker.customers.generateBatchInside(sectorsBatch, customers)
  const listInsert = { '/app/customers/batch': { batch: listBatch } }
  const update = { '/app/routing/update': { path: '/app/customers' } }
  return [install, cd, sectorsInsert, listInsert, update]
}

export default {
  title: 'AI',
  component: ThreeBox,
  args: { dev: { '/crm': apps.crm.covenant } },
}

const Template = (args) => {
  Debug.enable('*Nav iplog *Syncer')
  return (
    <Engine {...args}>
      <Syncer path="/app">
        <ThreeBox />
      </Syncer>
    </Engine>
  )
}

export const AddCustomer = Template.bind({})
AddCustomer.play = play(makeInit())
