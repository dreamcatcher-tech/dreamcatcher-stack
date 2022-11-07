import React from 'react'
import { SectorSelector } from '../components'
import complex from './topProps'
import Debug from 'debug'
const debug = Debug('SectorSelector')
Debug.enable('*SectorSelector')
export default {
  title: 'SectorSelector',
  component: SectorSelector,

  args: {
    expanded: true,
    complex: complex.child('routing'),
  },
}

const Template = (args) => {
  const [selected, onSelected] = React.useState()
  return <SectorSelector {...{ ...args, selected, onSelected }} />
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
