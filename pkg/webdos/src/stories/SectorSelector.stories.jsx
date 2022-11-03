import React from 'react'
import { SectorSelector } from '../components'
import Debug from 'debug'
const debug = Debug('SectorSelector')
Debug.enable('*SectorSelector')
const COLORS = [
  'red',
  'orange',
  'yellow',
  'cyan',
  'purple',
  'violet',
  'pink',
  'green',
  'black',
]
export default {
  title: 'SectorSelector',
  component: SectorSelector,

  args: {
    expanded: true,
    sectors: [
      {
        name: 'Monday A Run',
        next: 'Wed, Jan 9, 234 customers',
        color: COLORS[0],
      },
      {
        name: 'Monday B Run',
        next: 'Wed, Jan 9, 234 customers',
        color: COLORS[1],
      },
      {
        name: 'Monday C Run',
        next: 'Wed, Jan 9, 234 customers',
        color: COLORS[2],
      },
      {
        name: 'Monday D Run',
        next: 'Wed, Jan 9, 234 customers',
        color: COLORS[3],
      },
    ],
  },
}

const Template = (args) => {
  const [selected, onSelected] = React.useState(args.sectors[0].name)
  return <SectorSelector {...{ ...args, selected, onSelected }} />
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
Expanded.args = {}
