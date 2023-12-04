import React from 'react'
import { Engine, Syncer } from '..'
import ThreeBox from '../components/AI/ThreeBox'
import { apps } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import play from '../Interactions'
import Debug from 'debug'
const debug = Debug('App')

/**
We should be able to make a dedicated covenant that knows how to run some tests on the Goalie when given a list of prompts to run.  Can have some initial options in the text that says if you should run HAL for real, or if you should just run the goalie and stop.

So in storybook, we would load up HAL like normal, install the app for doing Goalie tests, then dump in the prompt requesting it to do the test.  The Goalie should detect that we want to test the Goalie, and begin operating this app.

Goals should be prefixed by the path, so like "add new item" should have a path like "apps/crm/customers" so that it scopes the goal to the right app.

Goaling also helps find help using embeddings since goals are what help is indexes on.
 */

const makeInit = () => {
  const ai = { bootHal: {} }
  return [ai]
}

export default {
  title: 'AI',
  component: ThreeBox,
}

const Template = (args) => {
  Debug.enable('')
  return (
    <Engine dev={{ '/crm': apps.crm.covenant }} {...args}>
      <Syncer path="/.HAL">
        <ThreeBox preload={tests} preSubmit />
      </Syncer>
    </Engine>
  )
}

export const Goalie = Template.bind({})
Goalie.play = play(makeInit())

const tests = `add a customer

change directory

who much are bananas ?

Do I need an umbrella in kincardine ?

delete this customer`
