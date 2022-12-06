import React from 'react'
import Box from '@mui/material/Box'
import { SectorSelector, Glass } from '..'
import Debug from 'debug'
const debug = Debug('SectorSelector')
import data from './data'

export default {
  title: 'SectorSelector',
  component: SectorSelector,

  args: {
    expanded: true,
    complex: data.small.child('routing'),
  },
}

const Template = (args) => {
  Debug.enable('*SectorSelector')
  const [selected, onSelected] = React.useState()
  return (
    <Glass.Container debug>
      <Glass.Left debug>
        <SectorSelector {...{ ...args, selected, onSelected }} />
        <Box
          sx={{
            flexGrow: 1,
            background: 'red',
            minHeight: '200px',
          }}
        >
          Filler
        </Box>
      </Glass.Left>
    </Glass.Container>
  )
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
