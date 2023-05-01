import PropTypes from 'prop-types'
import React from 'react'
import Button from '@mui/material/Button'
import { Engine, Syncer } from '..'
import { CustomerModal } from '../components'
import { apps, Crisp } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Datum')
const { faker } = apps.crm
faker.customers.reset()
const customer = faker.customers.generateSingle()

export default {
  title: 'Customer Modal',
  component: CustomerModal,
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

const Controller = ({ crisp, editing }) => {
  if (!crisp || crisp.isLoadingChildren) {
    return
  }
  const selected = crisp.getSelectedChild()
  const child = selected && crisp.hasChild(selected) && crisp.getChild(selected)
  const onClick = () => {
    crisp.actions.cd(crisp.absolutePath + '/' + customer.formData.custNo)
  }
  const onClose = () => {
    crisp.actions.cd(crisp.absolutePath)
  }
  return (
    <>
      <Button variant="contained" onClick={onClick}>
        open dialog
      </Button>
      <CustomerModal
        customer={child || null}
        onClose={onClose}
        editing={editing}
      />
    </>
  )
}
Controller.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  editing: PropTypes.bool,
}

const Template = (args) => {
  Debug.enable('iplog *Datum *CustomerModal *Gps *Map')
  debug(customer)
  return (
    <Engine {...args}>
      <Syncer path={args.path}>
        <Controller editing={args.editing} />
      </Syncer>
    </Engine>
  )
}

export const Customer = Template.bind({})
export const Editing = Template.bind({})
Editing.args = { editing: true }
