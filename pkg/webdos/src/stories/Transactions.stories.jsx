import { Engine, Syncer } from '..'
import PropTypes from 'prop-types'
import { apps, Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { Transactions } from '../components'
import Debug from 'debug'
const { faker } = apps.crm
faker.customers.reset()
const customer = faker.customers.generateSingle()

export default {
  title: 'Transactions',
  component: Transactions,
  args: {
    dev: { '/crm': apps.crm.covenant },
    path: '/list',
    init: [
      { add: { path: 'list', installer: '/crm/customers' } },
      { '/list/add': customer },
      { cd: { path: '/list/' + customer.formData.custNo } },
    ],
  },
}

const Controller = ({ crisp }) => {
  if (!crisp || crisp.isLoadingChildren) {
    return
  }
  const selected = crisp.getSelectedChild()
  const child = selected && crisp.hasChild(selected) && crisp.getChild(selected)
  if (!child) {
    return <div>Loading...</div>
  }
  return <Transactions crisp={child} />
}
Controller.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  editing: PropTypes.bool,
}

const Template = (args) => {
  Debug.enable('*Map *Gps')
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <Controller editing={args.editing} />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const Windowed = (args) => {
  return (
    <div style={{ height: '200px', width: '200px' }}>
      <Transactions {...args} />
    </div>
  )
}
Windowed.parameters = { layout: 'centered' }

export const Editing = Template.bind({})
Editing.args = { editing: true }
