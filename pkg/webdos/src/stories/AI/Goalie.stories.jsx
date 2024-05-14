import React from 'react'
import { Engine, Syncer } from '../..'
import ThreeBox from '../../components/AI/ThreeBox'
import { apps } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import play from '../../Interactions'
import Debug from 'debug'
const debug = Debug('App')

/**
We should be able to make a dedicated covenant that knows how to run some tests on the Goalie when given a list of prompts to run.  Can have some initial options in the text that says if you should run HAL for real, or if you should just run the goalie and stop.

So in storybook, we would load up HAL like normal, install the app for doing Goalie tests, then dump in the prompt requesting it to do the test.  The Goalie should detect that we want to test the Goalie, and begin operating this app.

Goals should be prefixed by the path, so like "add new item" should have a path like "apps/crm/customers" so that it scopes the goal to the right app.

Goaling also helps find help using embeddings since goals are what help is indexes on.

Where is the goaling chain ?
It could be an AI node, or it could be done within HALs logic.
But we need a list of goals, so we could store in state, or we could make it be children

send() calls into the goaler first, which gives us back a goal.
Depending on the status HALs goal changes - figure out what HAL wants, or proceed with the given goal.
First we would fire up the thread with the goalie, which is the threadmaster
Then when we get the response from the goalie, we set up HALs directions.

 */
const { faker } = apps.crm
faker.customers.reset()
const makeInit = ({ sectors = 2, customers = 10 } = {}) => {
  const ai = { bootHal: {} }
  const add = { add: { path: '/apps' } }
  const install = { add: { path: '/apps/crm', installer: '/crm' } }
  const sectorsBatch = faker.routing.generateBatch(sectors)
  const sectorsInsert = { '/apps/crm/routing/batch': { batch: sectorsBatch } }
  const listBatch = faker.customers.generateBatchInside(sectorsBatch, customers)
  const listInsert = { '/apps/crm/customers/batch': { batch: listBatch } }
  const update = { '/apps/crm/routing/update': { path: '/apps/crm/customers' } }
  return [ai, add, install, sectorsInsert, listInsert, update]
}

export default {
  title: 'AI',
  component: ThreeBox,
}

const Template = () => {
  Debug.enable('*StateBoard')
  return (
    <Engine dev={{ '/crm': apps.crm.covenant }}>
      <Syncer path="/">
        <ThreeBox preload={tests} preSubmit />
      </Syncer>
    </Engine>
  )
}

export const Goalie = Template.bind({})
Goalie.play = play(makeInit())

const tests = 'add a customer named Karen'
// const tests = `add a customer

// change directory

// who much are bananas ?

// Do I need an umbrella in kincardine ?

// delete this customer`
