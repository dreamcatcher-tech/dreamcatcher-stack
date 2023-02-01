import React from 'react'
import { Engine, Syncer, App } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import { car } from './data'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('App')

const { faker } = apps.crm
faker.customers.reset()
const install = { add: { path: '/app', installer: '/crm' } }
const sectorsBatch = faker.routing.generateBatch(2)
const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 10)
const listInsert = { '/app/customers/batch': { batch: listBatch } }
const update = { '/app/routing/update': { path: '/app/customers' } }
const cd = { cd: { path: '/app/routing' } }

export default {
  title: 'App',
  component: App,
  args: {
    dev: { '/crm': apps.crm.covenant },
    init: [install, sectorsInsert, listInsert, update, cd],
  },
}

const Template = (args) => {
  Debug.enable('*App *Nav *Date iplog')
  return (
    <Engine {...args}>
      <Syncer path="/app">
        <App />
      </Syncer>
    </Engine>
  )
}
Template.propTypes = {
  // car: PropTypes.shape({ url: PropTypes.string, path: PropTypes.string }),
}

export const Small = Template.bind({})
Small.args = { car: car.small }

// TODO add customers into the app from large and see how the app responds
// export const Growing = Template.bind({})

// TODO simulate a slow network and see how the app responds
// export const Loading = Template.bind({})
