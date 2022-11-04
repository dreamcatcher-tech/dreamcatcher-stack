import React from 'react'
import { Nav } from '../components'
import topProps from './topProps'
import Debug from 'debug'
const debug = Debug('Nav')
Debug.enable('*Nav')

export default {
  title: 'Nav',
  component: Nav,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: 'fullscreen',
  },

  args: topProps,
}

const Template = (args) => {
  const [wd, setWd] = React.useState(args.wd)
  args.actions = {
    ...args.actions,
    cd: (path) => {
      debug('cd', path)
      setWd(path)
    },
  }
  args.wd = wd
  return <Nav {...args} />
}

export const Basic = Template.bind({})
Basic.args = {}

export const Selection = Template.bind({})
Selection.args = { wd: '/customers' }

export const NoSettings = Template.bind({})
NoSettings.args = {
  network: { ...topProps.network },
}
delete NoSettings.args.network.settings

export const Relative = Template.bind({})
Relative.args = {
  network: { ...topProps.network, '../schedule': {} },
  wd: '/../schedule',
}
