import React from 'react'
import { SectorDatum, Datum } from '../components'
import { apps, api } from '@dreamcatcher-tech/interblock'

import Debug from 'debug'
const debug = Debug('SectorDatum')
Debug.enable('*SectorDatum')

const { schemaToFunctions } = api
const { sector } = apps

const formData = {
  name: 'Monday A Run',
  color: 'cyan',
  frequencyInDays: 7,
  frequencyOffset: 2,
  geometry: {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [175.238457, -37.723479],
          [175.202751, -37.749001],
          [175.252876, -37.746015],
          [175.238457, -37.723479],
        ],
      ],
    },
  },
  order: ['custNo-0345', 'custNo-3234', 'custNo-2345'],
}
let { state } = sector
state = { ...state, formData }

export default {
  title: 'SectorDatum',
  component: SectorDatum,

  args: {
    state,
  },
}

const Template = (args) => <Datum {...args} />

export const Default = Template.bind({})
Default.args = { expanded: false }
export const Basic = Template.bind({})
Basic.args = {}
export const ReadOnly = Template.bind({})
ReadOnly.args = {}
