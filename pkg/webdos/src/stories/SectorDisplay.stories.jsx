import React from 'react'
import { SectorDisplay } from '..'
import { apps, api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const { faker } = apps.crm
const debug = Debug('SectorDisplay')

export default {
  title: 'SectorDisplay',
  component: SectorDisplay,

  args: {
    complex: faker.child('routing').child('0'),
  },
}

const Template = (args) => {
  Debug.enable('*SectorDisplay *Sorter')

  return <SectorDisplay {...args} />
}

export const Basic = Template.bind({})
export const Blank = Template.bind({})
Blank.args = { complex: null }
