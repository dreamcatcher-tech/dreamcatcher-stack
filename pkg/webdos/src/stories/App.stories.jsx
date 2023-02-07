import React from 'react'
import { Engine, Syncer } from '..'
import { App } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import { car } from './data'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('App')

const { faker } = apps.crm
faker.customers.reset()
const makeInit = ({ sectors = 2, customers = 10 } = {}) => {
  const install = { add: { path: '/app', installer: '/crm' } }
  const sectorsBatch = faker.routing.generateBatch(sectors)
  const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
  const listBatch = faker.customers.generateBatchInside(sectorsBatch, customers)
  const listInsert = { '/app/customers/batch': { batch: listBatch } }
  const update = { '/app/routing/update': { path: '/app/customers' } }
  const cd = { '/cd': { path: '/app/routing' } }
  return [install, sectorsInsert, listInsert, update, cd]
}

export default {
  title: 'App',
  component: App,
  args: {
    dev: { '/crm': apps.crm.covenant },
    init: makeInit(),
  },
}

const Template = (args) => {
  Debug.enable('*Nav iplog')
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

export const Medium = Template.bind({})
Medium.args = { init: makeInit({ sectors: 40, customers: 200 }) }
// make it load gradually so can see it behave during loading

// can use a CAR if think all further problems are GUI related

// TODO add customers into the app from large and see how the app responds
// export const Growing = Template.bind({})

// TODO simulate a slow network and see how the app responds
// export const Loading = Template.bind({})
