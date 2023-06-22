import PropTypes from 'prop-types'
import delay from 'delay'
import React from 'react'
import { Engine, Syncer } from '..'
import { Map, Glass } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
const {
  crm: { faker },
} = apps
const debug = Debug('Map')

const sectorsAdd = { add: { path: '/routing', installer: '/crm/routing' } }
const sectorsBatch = faker.routing.generateBatch(5)
const sectorsInsert = { '/routing/batch': { batch: sectorsBatch } }
const listAdd = { '/add': { path: '/customers', installer: '/crm/customers' } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 15)
const listInsert = { '/customers/batch': { batch: listBatch } }
const update = { '/routing/update': { path: '/customers' } }
const init = [sectorsAdd, sectorsInsert]

export default {
  title: 'Map',
  component: Map,
  args: { dev: { '/crm': apps.crm.covenant }, init },
}
const Controller = ({ crisp }) => {
  let routing, customers
  if (!crisp.isLoadingChildren) {
    if (crisp.hasChild('routing')) {
      routing = crisp.getChild('routing')
    }
    if (crisp.hasChild('customers')) {
      customers = crisp.getChild('customers')
    }
  }
  return <Map routing={routing} customers={customers} />
}
Controller.propTypes = { crisp: PropTypes.object }
const Template = (args) => {
  Debug.enable('*Map*')
  return (
    <Engine {...args}>
      <Syncer path="/">
        <Controller />
      </Syncer>
    </Engine>
  )
}

export const Sectors = Template.bind({})
Sectors.args = {}

export const Customers = Template.bind({})
Customers.args = { init: [] }
Customers.play = async ({ args, canvasElement, step, ...rest }) => {
  debug('play', rest, args)
  while (!globalThis.interpulse) {
    await delay(100)
  }
  await step('add sectors', async () => {
    await globalThis.interpulse.execute(sectorsAdd)
  })
  await step('insert sectors', async () => {
    await globalThis.interpulse.execute(sectorsInsert)
  })
  await step('select sector', async () => {
    await globalThis.interpulse.execute({ '/cd': { path: '/routing/0' } })
  })
  await step('add customers', async () => {
    await globalThis.interpulse.execute(listAdd)
  })
  await step('insert customers', async () => {
    await globalThis.interpulse.execute(listInsert)
  })
  await step('update routing', async () => {
    await globalThis.interpulse.execute(update)
  })
  await step('select sector', async () => {
    await globalThis.interpulse.execute({ '/cd': { path: '/routing/1' } })
  })
  await step('select sector', async () => {
    await globalThis.interpulse.execute({ '/cd': { path: '/routing/2' } })
  })
  await step('select sector', async () => {
    await globalThis.interpulse.execute({ '/cd': { path: '/routing/3' } })
  })
  await step('select sector', async () => {
    await globalThis.interpulse.execute({ '/cd': { path: '/routing/4' } })
  })
}

export const CardColumn = (args) => {
  return (
    <>
      <Glass.Container>
        <Glass.Left min>
          <Card style={{ minHeight: '200px' }}>
            <CardContent>Right hand side is draggable</CardContent>
          </Card>
        </Glass.Left>
      </Glass.Container>
      <Map />
    </>
  )
}
