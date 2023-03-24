import React from 'react'
import { Engine, Syncer } from '..'
import { Datum, Glass } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Datum')
const { faker } = apps.crm
faker.customers.reset()
const customer = faker.customers.generateSingle()

export default {
  title: 'Datum',
  component: Datum,
  args: {
    dev: { '/crm': apps.crm.covenant },
    path: '/list',
    init: [
      { add: { path: 'list', installer: '/crm/customers' } },
      { '/list/add': customer },
    ],
  },
}

const Template = (args) => {
  Debug.enable('iplog *Datum')
  debug(customer)
  return (
    <Glass.Container>
      <Glass.Left>
        <Engine {...args}>
          <Syncer path={args.path}>
            <Syncer.UnWrapper path={customer.formData.custNo + ''}>
              <Datum {...args} />
            </Syncer.UnWrapper>
          </Syncer>
        </Engine>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Customer = Template.bind({})
