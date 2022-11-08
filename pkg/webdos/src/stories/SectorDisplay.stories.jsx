import React from 'react'
import { SectorDisplay } from '../components'
import { apps, api } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const { faker } = apps
const debug = Debug('SectorDisplay')
Debug.enable('*SectorDisplay')

export default {
  title: 'SectorDisplay',
  component: SectorDisplay,

  args: {
    complex: faker.child('routing').child('0'),
  },
}

const Template = (args) => <SectorDisplay {...args} />

export const Basic = Template.bind({})
export const Blank = Template.bind({})
Blank.args = { complex: null }
