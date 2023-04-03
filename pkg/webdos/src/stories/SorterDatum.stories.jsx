import PropTypes from 'prop-types'
import React from 'react'
import { Engine, Syncer } from '..'
import { Glass, SorterDatum } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('SorterDatum')
const { faker } = apps.crm

const sectorsAdd = { add: { path: '/routing', installer: '/crm/routing' } }
const sectors = faker.routing.generateBatch(1)
const sectorsInsert = { '/routing/batch': { batch: sectors } }
const listAdd = { add: { path: '/customers', installer: '/crm/customers' } }
faker.customers.reset()
const lists = faker.customers.generateBatchInside(sectors, 5)
const listInsert = { '/customers/batch': { batch: lists } }
const update = { '/routing/update': { path: '/customers' } }
const cd = { cd: { path: '/routing/0/779', allowVirtual: true } }

const init = [sectorsAdd, listAdd, sectorsInsert, listInsert, update]

export default {
  title: 'SorterDatum',
  component: SorterDatum,
  args: { dev: { '/crm': apps.crm.covenant }, init },
}
const Controller = ({ crisp, ...args }) => {
  let sector, customers
  if (!crisp.isLoadingChildren) {
    if (crisp.hasChild('routing')) {
      const routing = crisp.getChild('routing')
      if (!routing.isLoadingChildren && routing.hasChild('0')) {
        sector = routing.getChild('0')
      }
    }
    if (crisp.hasChild('customers')) {
      customers = crisp.getChild('customers')
    }
  }
  return <SorterDatum crisp={sector} customers={customers} {...args} />
}
Controller.propTypes = { crisp: PropTypes.object }

const Template = (args) => {
  Debug.enable('*Datum *Sorter *SorterDatum')
  const onOrder = (order) => {
    debug('onOrder', order)
  }
  args.onOrder = onOrder

  return (
    <Glass.Container>
      <Glass.Left max>
        <Engine {...args}>
          <Syncer>
            <Controller {...args} />
          </Syncer>
        </Engine>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Small = Template.bind({})

export const Blank = Template.bind({})
Blank.args = { init: [sectorsAdd, sectorsInsert] }

export const Selected = Template.bind({})
Selected.args = { init: [...init, cd] }

export const ReadOnly = Template.bind({})
ReadOnly.args = { viewOnly: true }

export const Editing = Template.bind({})
Editing.args = { editing: true }

export const Unapproved = Template.bind({})
