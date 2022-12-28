import React from 'react'
import { system, api, apps } from '@dreamcatcher-tech/interblock'
import { Engine, Complex } from '../..'
import PropTypes from 'prop-types'
import Debug from 'debug'
Debug.enable('*Actions')
const { shell } = system
const { schemaToFunctions } = api

export default {
  title: 'Blockchain/Complex',
  // component: Actions,
  args: {
    repo: 'interpulse-storybook',
    dev: { '/dpkg/crm': apps.crm.covenant },
  },
}

const Test = ({ complex }) => {
  return <div>{JSON.stringify(complex, null, 2)}</div>
}
Test.propTypes = {
  complex: PropTypes.instanceOf(api.Complex),
}

const Template = (args) => {
  Debug.enable('*Engine *Complex iplog*')
  return (
    <Engine {...args}>
      <Complex path="/crm">
        <Test />
      </Complex>
    </Engine>
  )
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})

export const CRM = Template.bind({})
CRM.args = {
  ram: true,
  // TODO make init be a function that does anything at all ?
  init: [{ add: { path: 'crm', installer: '/dpkg/crm' } }],
}
