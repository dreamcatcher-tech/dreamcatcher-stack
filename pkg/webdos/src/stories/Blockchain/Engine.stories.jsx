import React from 'react'
import { system, api } from '@dreamcatcher-tech/interblock'
import { Engine, Complex } from '../..'
import PropTypes from 'prop-types'
import Debug from 'debug'
Debug.enable('*Actions')
const { shell } = system
const { schemaToFunctions } = api

export default {
  title: 'Blockchain/Complex',
  // component: Actions,
  args: {},
}

const Test = ({ complex }) => {
  return <div>{JSON.stringify(complex, null, 2)}</div>
}
Test.propTypes = {
  complex: PropTypes.instanceOf(api.Complex),
}

const Template = (args) => {
  Debug.enable('*Engine *Complex')
  return (
    <Engine repo="interpulse-1">
      <Complex path="/">
        <Test />
      </Complex>
    </Engine>
  )
}

// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
export const Basic = Template.bind({})
