import React from 'react'
import { Manifest } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
import '../../../../data/test'
const debug = Debug('Nav')
Debug.enable('*Nav')
const { manifest } = apps

export default {
  title: 'Manifest',
  component: Manifest,

  args: {
    expanded: true,
    state: manifest.state,
  },
}

const Template = (args) => {
  Debug.enable('*CollectionList *Manifest')
  return <Manifest {...args} />
}

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
export const Published = Template.bind({})
Published.args = {
  state: { ...manifest.state, isPublished: true },
}
export const Reconciled = Template.bind({})
Reconciled.args = {
  state: { ...manifest.state, isPublished: true, isReconciled: true },
}
export const WithRows = Template.bind({})
WithRows.args = {
  state: {
    ...manifest.state,
    isPublished: true,
    isReconciled: true,
    rows: [
      {
        id: '1234',
      },
    ],
  },
}
