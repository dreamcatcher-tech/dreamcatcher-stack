import React from 'react'
import { SectorSelector, Glass } from '..'
import Debug from 'debug'
const debug = Debug('SectorSelector')
import data from './data'
const complex = data.small.child('routing')

export default {
  title: 'SectorSelector',
  component: SectorSelector,
  args: {
    complex,
  },
}

const Template = (args) => {
  Debug.enable('*SectorSelector')
  const [selected, onSelected] = React.useState()
  return (
    <Glass.Container>
      <Glass.Left>
        <SectorSelector {...{ ...args, selected, onSelected }} />
        <div
          style={{
            flexGrow: 1,
            background: 'red',
            minHeight: '200px',
          }}
        >
          Filler
        </div>
      </Glass.Left>
      <Glass.Center debug />
    </Glass.Container>
  )
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
Expanded.args = { expanded: true }
export const Blank = Template.bind({})
Blank.args = { complex: complex.setNetwork([]) }
