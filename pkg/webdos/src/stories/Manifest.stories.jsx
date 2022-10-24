import React from 'react'
import { Manifest } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Nav')
Debug.enable('*Nav')

export default {
  title: 'Manifest',
  component: Manifest,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'fullscreen',
  },

  args: {
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

export const Basic = Template.bind({})
Basic.args = {}

export const Selection = Template.bind({})
Basic.args = { wd: '/customers' }

export const NoSettings = Template.bind({})
NoSettings.args = {
  network: ['schedule', 'customers', 'routing', 'about', 'account'],
}

export const Relative = Template.bind({})
Relative.args = {
  network: [
    '../schedule',
    'customers',
    'routing',
    'settings',
    'about',
    'account',
  ],
}
