import React from 'react'
import { SectorSelector, Glass } from '..'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('SectorSelector')
const { faker } = apps.crm
export default {
  title: 'SectorSelector',
  component: SectorSelector,

  args: {
    expanded: true,
    complex: faker().child('routing'),
  },
}

const Template = (args) => {
  Debug.enable('*SectorSelector')
  const [selected, onSelected] = React.useState()
  return (
    <Glass.Container>
      <Glass.Left>
        <SectorSelector {...{ ...args, selected, onSelected }} />
      </Glass.Left>
    </Glass.Container>
  )
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
