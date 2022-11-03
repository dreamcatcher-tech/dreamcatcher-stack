import React from 'react'
import { Manifest } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Nav')
Debug.enable('*Nav')

export default {
  title: 'Manifest',
  component: Manifest,

  args: {
    expanded: true,
    actions: {
      cd: (path) => {
        console.log('cd', path)
        return new Promise((r) => setTimeout(r, 1000))
      },
    },
    network: [
      'schedule',
      'customers',
      'routing',
      'settings',
      'about',
      'account',
    ],
    wd: '/schedule',
  },
}

const Template = (args) => <Manifest {...args} />

export const Collapsed = Template.bind({})
Collapsed.args = { expanded: false }
export const Expanded = Template.bind({})
Expanded.args = {}
export const Published = Template.bind({})
Published.args = {}
export const Reconciled = Template.bind({})
Reconciled.args = {
  isPublished: true,
  isReconciled: true,
}
