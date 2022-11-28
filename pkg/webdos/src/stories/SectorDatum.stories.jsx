import React from 'react'
import { Datum, Glass } from '..'
import { apps, api } from '@dreamcatcher-tech/interblock'
import data from './data'
import Debug from 'debug'
const { faker } = apps.crm
const debug = Debug('SectorDatum')

export default {
  title: 'SectorDatum',
  component: Datum,
  args: {
    complex: data.small.child('routing').child('13'),
  },
}

const Template = (args) => {
  Debug.enable('*SectorDatum *Datum')
  debug('order length:', args.complex.state.formData.order.length)
  return (
    <Glass.Container>
      <Glass.Left>
        <Datum {...args} />
      </Glass.Left>
    </Glass.Container>
  )
}

export const ReadOnly = Template.bind({})
ReadOnly.args = {}
export const Small = Template.bind({})
Small.args = {}
export const Medium = Template.bind({})
Medium.args = { complex: data.medium.child('routing').child('13') }
export const Large = Template.bind({})
Large.args = { complex: data.large.child('routing').child('13') }
