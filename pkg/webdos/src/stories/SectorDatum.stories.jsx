import React from 'react'
import { Datum } from '../components'
import { apps, api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const { faker } = apps
const debug = Debug('SectorDatum')

export default {
  title: 'SectorDatum',
  component: Datum,

  args: {
    complex: faker.child('routing').child('0'),
  },
}

const Template = (args) => {
  Debug.enable('*SectorDatum')
  return <Datum {...args} />
}

export const Default = Template.bind({})
Default.args = { expanded: false }
export const Basic = Template.bind({})
Basic.args = {}
export const ReadOnly = Template.bind({})
ReadOnly.args = {}
