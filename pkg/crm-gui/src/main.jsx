import React from 'react'
import ReactDOM from 'react-dom/client'
import { Engine, Syncer, App } from '@dreamcatcher-tech/webdos'
import { apps } from '@dreamcatcher-tech/interblock'

const { faker } = apps.crm
const makeInit = ({ sectors = 2, customers = 10 } = {}) => {
  faker.customers.reset()
  const install = { add: { path: '/app', installer: '/crm' } }
  const sectorsBatch = faker.routing.generateBatch(sectors)
  const sectorsInsert = { '/app/routing/batch': { batch: sectorsBatch } }
  const listBatch = faker.customers.generateBatchInside(sectorsBatch, customers)
  const listInsert = { '/app/customers/batch': { batch: listBatch } }
  const update = { '/app/routing/update': { path: '/app/customers' } }
  const cd = { '/cd': { path: '/app/routing' } }
  return [install, sectorsInsert, listInsert, update, cd]
}

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <Engine dev={{ '/crm': apps.crm.covenant }} init={makeInit()}>
    <Syncer path="/app">
      <App />
    </Syncer>
  </Engine>
  // </React.StrictMode>
)
