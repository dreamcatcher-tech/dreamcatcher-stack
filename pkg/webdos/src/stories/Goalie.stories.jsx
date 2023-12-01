import React from 'react'
import { Engine, Syncer } from '..'
import ThreeBox from '../components/AI/ThreeBox'
import { apps } from '@dreamcatcher-tech/interblock'
import PropTypes from 'prop-types'
import play from '../Interactions'
import Debug from 'debug'
const debug = Debug('App')

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
