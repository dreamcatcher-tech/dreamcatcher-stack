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
  const ai = { bootHal: {} }
  const add = { add: { path: '/apps' } }
  const install = { add: { path: '/apps/crm', installer: '/crm' } }
  const sectorsBatch = faker.routing.generateBatch(sectors)
  const sectorsInsert = { '/apps/crm/routing/batch': { batch: sectorsBatch } }
  const listBatch = faker.customers.generateBatchInside(sectorsBatch, customers)
  const listInsert = { '/apps/crm/customers/batch': { batch: listBatch } }
  const update = { '/apps/crm/routing/update': { path: '/apps/crm/customers' } }
  return [ai, add, install, sectorsInsert, listInsert, update]
}

export default {
  title: 'AI',
  component: ThreeBox,
}

const Template = (args) => {
  Debug.enable('iplog')
  return (
    <Engine dev={{ '/crm': apps.crm.covenant }} {...args}>
      <Syncer path="/.HAL">
        <ThreeBox />
      </Syncer>
    </Engine>
  )
}

export const AddCustomer = Template.bind({})
AddCustomer.play = play(makeInit())
