import PropTypes from 'prop-types'
import React from 'react'
import { Engine, Syncer, Datum, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Datum')

export default {
  title: 'Datum',
  component: Datum,
  args: {
    dev: { '/dpkg/crm': apps.crm.covenant },
    path: '/list',
    init: [
      { add: { path: 'list', installer: '/dpkg/crm/customers' } },
      { 'list/add': { formData: { name: 'Bob', custNo: 1 } } },
    ],
  },
}
const UnWrapper = ({ crisp, ...args }) => {
  if (crisp.isLoading || !crisp.hasChild('1')) {
    return <div>Loading...</div>
  }
  const child = crisp.getChild('1')
  debug('child', child)
  return <Datum {...args} crisp={child} />
}
UnWrapper.propTypes = { crisp: PropTypes.object }

const Template = (args) => {
  Debug.enable('iplog *Datum')
  return (
    <Glass.Container>
      <Glass.Left>
        <Engine {...args}>
          <Syncer path={args.path}>
            <UnWrapper {...args} />
          </Syncer>
        </Engine>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Customer = Template.bind({})
